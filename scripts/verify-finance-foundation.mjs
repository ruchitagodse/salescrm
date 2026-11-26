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
    const db = drizzle(client);
    const rows = await db.execute(sql`
      select expected.name as table_name, c.oid is not null as table_exists, coalesce(c.relrowsecurity,false) as rls_enabled,
        coalesce(pg_get_expr(d.adbin,d.adrelid) in ('gen_random_uuid()','pg_catalog.gen_random_uuid()','public.gen_random_uuid()','extensions.gen_random_uuid()'),false) as uuid_default,
        (select count(*)::integer from pg_policies where schemaname='public' and tablename=expected.name) as policy_count,
        exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace pn on pn.oid=p.pronamespace
          where t.tgrelid=c.oid and t.tgtype=19 and t.tgenabled in ('O','A') and not t.tgisinternal and p.proname='set_updated_at' and pn.nspname='public') as timestamp_trigger,
        (select coalesce(json_agg(t.tgname),'[]'::json) from pg_trigger t where t.tgrelid=c.oid and t.tgenabled in ('O','A') and not t.tgisinternal) as triggers
      from (values ('quotations'),('quotation_items'),('orders'),('order_items'),('payments'),('expenses')) expected(name)
      left join pg_namespace n on n.nspname='public' left join pg_class c on c.relnamespace=n.oid and c.relname=expected.name and c.relkind='r'
      left join pg_attribute a on a.attrelid=c.oid and a.attname='id' and not a.attisdropped left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
      order by expected.name
    `);
    const [unique] = await db.execute(sql`select exists(select 1 from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace
      join pg_attribute a on a.attrelid=c.oid and a.attname='quotation_id' where n.nspname='public' and c.relname='orders' and i.indisunique and i.indpred is null and i.indisvalid and i.indnkeyatts=1 and i.indkey[0]=a.attnum) as one_order_per_quote,
      (select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='S' and c.relname in ('quotation_number_seq','order_number_seq'))=2 as reference_sequences`);
    const guards = { quotations: ["quotations_guard"], quotation_items: ["quotation_items_guard"], orders: ["orders_guard","orders_create_guard","orders_complete"], order_items: ["order_items_guard","order_items_create_guard","order_items_complete"], payments: ["payments_guard"], expenses: ["expenses_guard"] };
    const passed = rows.every((row) => row.table_exists && row.rls_enabled && row.uuid_default && row.policy_count === 0 && row.timestamp_trigger && guards[row.table_name].every((guard) => row.triggers.includes(guard))) && unique.one_order_per_quote && unique.reference_sequences;
    console.log(JSON.stringify({ connection, tables: rows, ...unique, passed }));
    if (!passed) process.exitCode = 1;
  } catch { console.error(JSON.stringify({ connection, check: "failed", rawDetails: "suppressed" })); process.exitCode = 1; }
  finally { if (client) await client.end({ timeout: 1 }); }
}
