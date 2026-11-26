import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

config({ path: ".env.local", quiet: true });
for (const connection of ["DATABASE_URL_MIGRATIONS", "DATABASE_URL"]) {
  let client;
  try {
    if (!process.env[connection]) throw new Error();
    client = postgres(process.env[connection], { prepare: false, max: 1, connect_timeout: 8 });
    const [row] = await drizzle(client).execute(sql`
      select c.oid is not null as table_exists, coalesce(c.relrowsecurity,false) as rls_enabled,
        coalesce(pg_get_expr(d.adbin,d.adrelid) in ('gen_random_uuid()','pg_catalog.gen_random_uuid()','public.gen_random_uuid()','extensions.gen_random_uuid()'),false) as uuid_default,
        (select count(*)::integer from pg_policies where schemaname='public' and tablename='activities') as policy_count,
        (select count(*)::integer from pg_constraint k where k.conrelid=c.oid and k.contype='f' and k.confdeltype='r') as restrict_fk_count,
        (select count(*)::integer from pg_constraint k where k.conrelid=c.oid and k.contype='c' and k.convalidated
          and k.conname in ('activities_title_check','activities_type_check','activities_status_check','activities_one_target_check','activities_completion_check')) as check_count,
        exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace pn on pn.oid=p.pronamespace
          where t.tgrelid=c.oid and t.tgtype=19 and not t.tgisinternal and t.tgenabled in ('O','A')
            and t.tgattr::text='' and t.tgqual is null and p.proname='set_updated_at' and pn.nspname='public') as updated_at_trigger,
        not exists(select 1 from (values ('id'),('title'),('type'),('status'),('due_at'),('completed_at'),('notes'),('contact_id'),('lead_id'),('deal_id'),('created_at'),('updated_at'),('deleted_at')) expected(name)
          where not exists(select 1 from information_schema.columns cols where cols.table_schema='public' and cols.table_name='activities' and cols.column_name=expected.name)) as columns_complete
      from (select 1) base left join pg_namespace n on n.nspname='public'
      left join pg_class c on c.relnamespace=n.oid and c.relname='activities' and c.relkind='r'
      left join pg_attribute a on a.attrelid=c.oid and a.attname='id' and not a.attisdropped
      left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
    `);
    const passed = row.table_exists && row.rls_enabled && row.uuid_default && row.policy_count === 0
      && row.restrict_fk_count === 3 && row.check_count === 5 && row.updated_at_trigger && row.columns_complete;
    console.log(JSON.stringify({ connection, ...row, passed }));
    if (!passed) process.exitCode = 1;
  } catch {
    console.error(JSON.stringify({ connection, check: "failed", details: "suppressed" })); process.exitCode = 1;
  } finally { if (client) await client.end({ timeout: 1 }); }
}
