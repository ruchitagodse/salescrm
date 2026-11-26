import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
config({path:'.env.local',quiet:true});
for(const connection of ['DATABASE_URL_MIGRATIONS','DATABASE_URL']){
 let client;
 try{
  if(!process.env[connection])throw new Error();client=postgres(process.env[connection],{prepare:false,max:1,connect_timeout:8});const db=drizzle(client);
  const rows=await db.execute(sql`select c.relname as table_name,c.relrowsecurity as rls_enabled,
    (select count(*)::integer from pg_policies where schemaname='public' and tablename=c.relname)=0 as no_policies,
    exists(select 1 from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attname='id' and pg_get_expr(d.adbin,d.adrelid) like '%gen_random_uuid()%') as uuid_default,
    exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid where t.tgrelid=c.oid and t.tgtype=19 and t.tgenabled in ('O','A') and p.proname='set_updated_at') as timestamp_trigger,
    exists(select 1 from pg_index i where i.indrelid=c.oid and i.indisunique and i.indpred is null and i.indisvalid and i.indnkeyatts=3) as unconditional_replay_unique
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('integration_events','integration_identities')`);
  const passed=rows.length===2&&rows.every(r=>r.rls_enabled&&r.no_policies&&r.uuid_default&&r.timestamp_trigger&&r.unconditional_replay_unique);
  console.log(JSON.stringify({connection,passed,tables:rows}));if(!passed)process.exitCode=1;
 }catch{console.error(JSON.stringify({connection,passed:false,rawDetails:'suppressed'}));process.exitCode=1;}
 finally{if(client)await client.end({timeout:1});}
}
