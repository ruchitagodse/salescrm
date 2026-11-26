import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { PIPELINE_STAGE_KEYS, PIPELINE_STAGE_LABELS } from "../src/lib/deal-values.ts";

config({ path: ".env.local", quiet: true });
// Read-only metadata/seeds; never print env values, raw errors or business rows.
for (const connection of ["DATABASE_URL_MIGRATIONS", "DATABASE_URL"]) {
  let client;
  try {
    if (!process.env[connection]) throw new Error();
    client = postgres(process.env[connection], { prepare: false, max: 1, connect_timeout: 8 });
    const db = drizzle(client);
    const tables = await db.execute(sql`
      select expected.name as table_name, c.oid is not null as table_exists,
        coalesce(c.relrowsecurity, false) as rls_enabled,
        coalesce(pg_get_expr(d.adbin,d.adrelid) in ('gen_random_uuid()', 'pg_catalog.gen_random_uuid()', 'public.gen_random_uuid()', 'extensions.gen_random_uuid()'), false) as uuid_default,
        (select count(*)::integer from pg_policies where schemaname='public' and tablename=expected.name) as policy_count,
        exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
          join pg_namespace pn on pn.oid=p.pronamespace
          where t.tgrelid=c.oid and not t.tgisinternal and t.tgtype=19
            and t.tgenabled in ('O','A') and t.tgattr::text='' and t.tgqual is null
            and p.proname='set_updated_at' and pn.nspname='public') as updated_at_trigger
      from (values ('deals'),('pipeline_stages')) expected(name)
      left join pg_namespace n on n.nspname='public'
      left join pg_class c on c.relnamespace=n.oid and c.relname=expected.name and c.relkind='r'
      left join pg_attribute a on a.attrelid=c.oid and a.attname='id' and not a.attisdropped
      left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum order by expected.name
    `);
    const [uniqueness] = await db.execute(sql`select exists(
      select 1 from pg_index i join pg_class c on c.oid=i.indrelid
      join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attname='lead_id'
      where n.nspname='public' and c.relname='deals' and i.indisunique and i.indisvalid
        and i.indpred is null and i.indnkeyatts=1 and i.indkey[0]=a.attnum
    ) as one_deal_per_lead`);
    const exists = tables.every((table) => table.table_exists);
    let seedsCorrect = false;
    if (exists) {
      const seeds = await db.execute(sql`select key,name,position from public.pipeline_stages where deleted_at is null order by position`);
      seedsCorrect = seeds.length === PIPELINE_STAGE_KEYS.length && PIPELINE_STAGE_KEYS.every((key, index) =>
        seeds[index].key === key && seeds[index].name === PIPELINE_STAGE_LABELS[key] && seeds[index].position === index);
    }
    const passed = tables.every((row) => row.table_exists && row.rls_enabled && row.uuid_default && row.policy_count === 0 && row.updated_at_trigger)
      && uniqueness.one_deal_per_lead && seedsCorrect;
    console.log(JSON.stringify({ connection, tables, ...uniqueness, seedsCorrect, passed }));
    if (!passed) process.exitCode = 1;
  } catch {
    console.error(JSON.stringify({ connection, check: "failed", details: "suppressed" }));
    process.exitCode = 1;
  } finally { if (client) await client.end({ timeout: 1 }); }
}
