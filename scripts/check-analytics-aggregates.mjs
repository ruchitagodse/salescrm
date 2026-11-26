import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { analyticsQuery } from '../src/lib/analytics-query.ts';
import { analyticsRange } from '../src/lib/analytics-values.ts';
config({path:'.env.local',quiet:true});
class Rollback extends Error {}
let client,contactId,step='connect'; const checks=[];
try{
  if(!process.env.DATABASE_URL)throw new Error();
  client=postgres(process.env.DATABASE_URL,{prepare:false,max:1,connect_timeout:8});const db=drizzle(client);
  const range=analyticsRange({start:'2001-01-30',end:'2001-02-02'},new Date());
  try{await db.transaction(async tx=>{
    await tx.execute(sql`set local statement_timeout='8s'`);
    const report=async()=> (await tx.execute(analyticsQuery(range)))[0].report;
    const before=await report(); step='fixtures';
    const [c]=await tx.execute(sql`insert into public.contacts(full_name,instagram_handle) values ('Analytics rollback','os_analytics_rollback') returning id`);contactId=c.id;
    const [s]=await tx.execute(sql`select id from public.pipeline_stages where key='discovery' and deleted_at is null`);
    const [l]=await tx.execute(sql`insert into public.leads(contact_id,source,created_at) values (${c.id},'other',${range.startInstant}::timestamptz) returning id`);
    const [old]=await tx.execute(sql`insert into public.leads(contact_id,source,created_at) values (${c.id},'other',${range.startInstant}::timestamptz-interval '1 second') returning id`);
    await tx.execute(sql`insert into public.deals(title,lead_id,stage_id,value_paise,created_at) values ('Analytics rollback',${l.id},${s.id},20000,${range.endExclusive}::timestamptz)`);
    const [d]=await tx.execute(sql`insert into public.deals(title,lead_id,stage_id,created_at) values ('Analytics rollback',${old.id},${s.id},${range.startInstant}::timestamptz) returning id`);
    await tx.execute(sql`insert into public.leads(contact_id,source,created_at,deleted_at) values (${c.id},'other',${range.startInstant}::timestamptz,now())`);
    const number=(BigInt('0x'+randomUUID().replaceAll('-','').slice(0,15))+1n).toString();
    const [q]=await tx.execute(sql`insert into public.quotations(number,title,deal_id,total_paise) values (${number}::bigint,'Analytics rollback',${d.id},100000) returning id`);
    for(const position of [0,1])await tx.execute(sql`insert into public.quotation_items(quotation_id,description,quantity,unit_price_paise,line_total_paise,position) values (${q.id},'Service',1,50000,50000,${position})`);
    await tx.execute(sql`update public.quotations set status='sent' where id=${q.id}`);await tx.execute(sql`update public.quotations set status='accepted' where id=${q.id}`);
    const [o]=await tx.execute(sql`insert into public.orders(number,quotation_id,title,customer_name,total_paise,created_at) values (${number}::bigint,${q.id},'Analytics rollback','Verification',100000,${range.startInstant}::timestamptz) returning id`);
    for(const position of [0,1])await tx.execute(sql`insert into public.order_items(order_id,description,quantity,unit_price_paise,line_total_paise,position) values (${o.id},'Service',1,50000,50000,${position})`);
    await tx.execute(sql`set constraints all immediate`);
    await tx.execute(sql`insert into public.payments(order_id,amount_paise,paid_on) values (${o.id},30000,'2001-01-30'),(${o.id},10000,'2001-02-03')`);
    const [p]=await tx.execute(sql`insert into public.payments(order_id,amount_paise,paid_on) values (${o.id},20000,'2001-02-02') returning id`);
    await tx.execute(sql`update public.payments set status='voided',void_reason='Verification',voided_at=now() where id=${p.id}`);
    await tx.execute(sql`insert into public.expenses(spent_on,payee,category,amount_paise) values ('2001-01-30','Verification','Tools',5000)`);
    const [e]=await tx.execute(sql`insert into public.expenses(spent_on,payee,category,amount_paise) values ('2001-02-02','Verification','Tools',7000) returning id`);
    await tx.execute(sql`update public.expenses set status='voided',void_reason='Verification',voided_at=now() where id=${e.id}`);
    step='aggregate_deltas';const after=await report();
    const expected={receipts:30000n,expenses:5000n,bookedValue:100000n,orderCount:1n,leadCount:1n,convertedCount:1n,dealCount:1n,outstanding:60000n,outstandingOrders:1n,openPipeline:20000n,openDeals:2n,unknownValues:1n};
    for(const [key,delta] of Object.entries(expected)){if(BigInt(after[key])-BigInt(before[key])!==delta)throw new Error();checks.push(key);}
    checks.push('voids_excluded','order_not_multiplied_by_items','India_start_boundary','exclusive_end_boundary','deleted_lead_excluded','conversion_deal_outside_period');
    throw new Rollback();
  },{isolationLevel:'repeatable read'});}catch(e){if(!(e instanceof Rollback))throw e;}
  step='rollback';const [r]=await db.execute(sql`select not exists(select 1 from public.contacts where id=${contactId}) as valid`);if(!r.valid)throw new Error();
  console.log(JSON.stringify({passed:true,checks,rollbackVerified:true,persistedFixtures:false}));
}catch(error){const codes=[];for(let e=error,i=0;e&&i<4;e=e.cause,i++)if(typeof e.code==='string'&&/^[A-Z0-9_]{1,40}$/.test(e.code))codes.push(e.code);console.error(JSON.stringify({passed:false,step,codes,rawDetails:'suppressed'}));process.exitCode=1;}
finally{if(client)await client.end({timeout:1});}
