import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

// Tooling may load env internally; never print its values or raw errors.
config({ path: ".env.local", quiet: true });
const names = [
  "DATABASE_URL", "DATABASE_URL_MIGRATIONS",
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];
console.log(JSON.stringify({ environment: names.map((name) => ({
  name, present: Boolean(process.env[name]),
})) }));

let client;
try {
  if (!process.env.DATABASE_URL_MIGRATIONS) {
    throw Object.assign(new Error(), { code: "MISSING_ENV" });
  }
  client = postgres(process.env.DATABASE_URL_MIGRATIONS, {
    prepare: false, max: 1, connect_timeout: 8, idle_timeout: 1,
  });
  const db = drizzle(client);
  const [result] = await db.execute(sql`
    select
      exists(select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'profiles' and c.relkind = 'r') as profiles_exists,
      coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'profiles'), false) as rls_enabled,
      (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'profiles') as policy_count,
      exists(select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        join pg_proc p on p.oid = t.tgfoid
        join pg_namespace pn on pn.oid = p.pronamespace
        where n.nspname = 'public' and c.relname = 'profiles'
          and pn.nspname = 'public' and p.proname = 'set_updated_at'
          and t.tgtype = 19 and not t.tgisinternal
          and t.tgnargs = 0 and t.tgattr::text = '' and t.tgqual is null
          and t.tgenabled in ('O', 'A')) as updated_at_trigger,
      exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'set_updated_at'
          and p.pronargs = 0 and p.prorettype = 'trigger'::regtype) as timestamp_function_exists,
      (select coalesce(json_agg(t.tgname), '[]'::json) from pg_trigger t
        join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'profiles' and not t.tgisinternal) as profile_trigger_names
  `);
  console.log(JSON.stringify({ sessionPoolerConnected: true, ...result }));
  if (!result.profiles_exists || !result.rls_enabled || result.policy_count !== 0 || !result.timestamp_function_exists || !result.updated_at_trigger) {
    process.exitCode = 1;
  }
  if (process.argv.includes("--business")) {
    const tables = await db.execute(sql`
      select expected.name as table_name,
        c.oid is not null as table_exists,
        coalesce(c.relrowsecurity, false) as rls_enabled,
        coalesce(pg_get_expr(d.adbin, d.adrelid) = any(array[
          'gen_random_uuid()', 'pg_catalog.gen_random_uuid()',
          'public.gen_random_uuid()', 'extensions.gen_random_uuid()'
        ]), false) as uuid_default,
        (select count(*)::integer from pg_policies
          where schemaname = 'public' and tablename = expected.name) as policy_count
      from (values ('companies'), ('contacts'), ('leads')) as expected(name)
      left join pg_namespace n on n.nspname = 'public'
      left join pg_class c on c.relnamespace = n.oid and c.relname = expected.name and c.relkind = 'r'
      left join pg_attribute a on a.attrelid = c.oid and a.attname = 'id' and not a.attisdropped
      left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
      order by expected.name
    `);
    const missing = await db.execute(sql`
      select expected.name as column_name
      from (values ('id'), ('contact_id'), ('source'), ('status'),
        ('entry_method'), ('source_detail'), ('service_needs'), ('requirement'),
        ('deadline'), ('budget_paise'), ('lost_reason'), ('converted_at'),
        ('notes'), ('created_at'), ('updated_at'), ('deleted_at')) as expected(name)
      where not exists(select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = 'leads'
          and c.column_name = expected.name)
      order by expected.name
    `);
    console.log(JSON.stringify({ businessTables: tables, missingLeadColumns: missing.map((row) => row.column_name) }));
    if (tables.some((row) => !row.table_exists || !row.rls_enabled || !row.uuid_default || row.policy_count !== 0) || missing.length) {
      process.exitCode = 1;
    }
  }
} catch (error) {
  const codes = [];
  let current = error;
  for (let i = 0; i < 4 && current; i++) {
    const code = typeof current.code === "string" ? current.code : "";
    if (/^[A-Z0-9_]{1,40}$/.test(code)) codes.push(code);
    current = current.cause;
  }
  console.error(JSON.stringify({ sessionPoolerCheck: "failed", codes }));
  process.exitCode = 1;
} finally {
  if (client) await client.end({ timeout: 1 });
}
