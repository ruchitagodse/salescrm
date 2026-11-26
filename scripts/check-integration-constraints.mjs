import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
config({path:'.env.local',quiet:true});
class Rollback extends Error{}
let client,contactId,eventId,identityId,step='connect';const checks=[];
const code=error=>{for(let e=error,i=0;e&&i<4;e=e.cause,i++)if(e.code==='23505'||e.code==='23514')return e.code;return null;};
try{
 if(!process.env.DATABASE_URL)throw new Error();client=postgres(process.env.DATABASE_URL,{prepare:false,max:1,connect_timeout:8});const db=drizzle(client);
 try{await db.transaction(async tx=>{
  await tx.execute(sql`set local statement_timeout='8s'`);
  const reject=async(name,expected,operation)=>{step=name;let valid=false;try{await tx.transaction(operation);}catch(e){valid=code(e)===expected;}if(!valid)throw new Error();checks.push(name);};
  step='fixtures';const account=randomUUID(),external=randomUUID(),sender=randomUUID();
  const [c]=await tx.execute(sql`insert into public.contacts(full_name,instagram_handle) values ('Integration rollback','os_integration_rollback') returning id`);contactId=c.id;
  const [l]=await tx.execute(sql`insert into public.leads(contact_id,source,entry_method) values (${c.id},'instagram','integration') returning id`);
  const [e]=await tx.execute(sql`insert into public.integration_events(channel,account_id,external_id,sender_id,occurred_at,kind,updated_at) values ('instagram',${account},${external},${sender},now(),'text','2000-01-01Z') returning id`);eventId=e.id;
  await reject('event_replay_unique','23505',t=>t.execute(sql`insert into public.integration_events(channel,account_id,external_id,occurred_at,kind) values ('instagram',${account},${external},now(),'text')`));
  await reject('processed_requires_lead','23514',t=>t.execute(sql`update public.integration_events set state='processed' where id=${e.id}`));
  await tx.execute(sql`update public.integration_events set state='processed',lead_id=${l.id} where id=${e.id}`);
  const [updated]=await tx.execute(sql`select updated_at>'2000-01-01Z'::timestamptz as valid from public.integration_events where id=${e.id}`);if(!updated.valid)throw new Error();checks.push('event_timestamp_trigger');
  const [identity]=await tx.execute(sql`insert into public.integration_identities(channel,account_id,sender_id,lead_id) values ('instagram',${account},${sender},${l.id}) returning id`);identityId=identity.id;
  await reject('sender_identity_unique','23505',t=>t.execute(sql`insert into public.integration_identities(channel,account_id,sender_id,lead_id) values ('instagram',${account},${sender},${l.id})`));
  await tx.execute(sql`update public.integration_events set deleted_at=now() where id=${e.id}`);await tx.execute(sql`update public.integration_identities set deleted_at=now() where id=${identity.id}`);
  await reject('archived_event_still_blocks_replay','23505',t=>t.execute(sql`insert into public.integration_events(channel,account_id,external_id,occurred_at,kind) values ('instagram',${account},${external},now(),'text')`));
  await reject('archived_sender_still_blocks_recreation','23505',t=>t.execute(sql`insert into public.integration_identities(channel,account_id,sender_id,lead_id) values ('instagram',${account},${sender},${l.id})`));
  await reject('invalid_channel_rejected','23514',t=>t.execute(sql`insert into public.integration_events(channel,account_id,external_id,occurred_at,kind) values ('invalid',${account},${randomUUID()},now(),'text')`));
  await reject('oversized_message_rejected','23514',t=>t.execute(sql`insert into public.integration_events(channel,account_id,external_id,occurred_at,kind,body) values ('instagram',${account},${randomUUID()},now(),'text',repeat('a',10001))`));
  // A failed ingestion savepoint cannot leave a success marker or sender mapping.
  const newExternal=randomUUID();let temporaryLead;
  try{await tx.transaction(async t=>{
   const [lead]=await t.execute(sql`insert into public.leads(contact_id,source,entry_method) values (${c.id},'whatsapp','integration') returning id`);temporaryLead=lead.id;
   await t.execute(sql`insert into public.integration_events(channel,account_id,external_id,occurred_at,kind,state,lead_id) values ('whatsapp',${account},${newExternal},now(),'text','processed',${lead.id})`);
   await t.execute(sql`insert into public.integration_identities(channel,account_id,sender_id,lead_id) values ('whatsapp',${account},${sender},${lead.id})`);throw new Rollback();
  });}catch(err){if(!(err instanceof Rollback))throw err;}
  const [atomic]=await tx.execute(sql`select not exists(select 1 from public.leads where id=${temporaryLead}) and not exists(select 1 from public.integration_events where account_id=${account} and external_id=${newExternal}) and not exists(select 1 from public.integration_identities where channel='whatsapp' and account_id=${account} and sender_id=${sender}) as valid`);if(!atomic.valid)throw new Error();checks.push('failed_ingestion_transaction_rolls_back_all_links');
  throw new Rollback();
 });}catch(e){if(!(e instanceof Rollback))throw e;}
 step='rollback';const [r]=await db.execute(sql`select not exists(select 1 from public.contacts where id=${contactId}) and not exists(select 1 from public.integration_events where id=${eventId}) and not exists(select 1 from public.integration_identities where id=${identityId}) as valid`);if(!r.valid)throw new Error();
 console.log(JSON.stringify({passed:true,checks,rollbackVerified:true,persistedFixtures:false}));
}catch{console.error(JSON.stringify({passed:false,step,rawDetails:'suppressed'}));process.exitCode=1;}
finally{if(client)await client.end({timeout:1});}
