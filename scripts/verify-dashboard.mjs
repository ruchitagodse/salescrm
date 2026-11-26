import {config} from 'dotenv';
import postgres from 'postgres';
import {drizzle} from 'drizzle-orm/postgres-js';
import {sql} from 'drizzle-orm';
import {analyticsQuery} from '../src/lib/analytics-query.ts';
import {dashboardQuery} from '../src/lib/dashboard-query.ts';
import {analyticsRange} from '../src/lib/analytics-values.ts';
import {dashboardDerived} from '../src/lib/dashboard-values.ts';
config({path:'.env.local',quiet:true});
const sum=(rows,key)=>rows.reduce((n,r)=>n+BigInt(r[key]),0n);
for(const connection of ['DATABASE_URL_MIGRATIONS','DATABASE_URL']){
 let client;
 try{
  if(!process.env[connection])throw Error();
  client=postgres(process.env[connection],{prepare:false,max:1,connect_timeout:8});
  const checks=await drizzle(client).transaction(async tx=>{
   const range=analyticsRange({},new Date());
   const [{report:b}]=await tx.execute(analyticsQuery(range));
   const [{report:e}]=await tx.execute(dashboardQuery(range,new Date(b.asOf)));
   // Independent direct counts, date arithmetic and average; no business rows or amounts are printed.
   const [q]=await tx.execute(sql`select count(*)::text n,coalesce(sum(total_paise),0)::text v from public.quotations where deleted_at is null and created_at>=${range.startInstant}::timestamptz and created_at<${range.endExclusive}::timestamptz`);
   const [d]=await tx.execute(sql`select count(value_paise)::text n,round(avg(value_paise))::text avg from public.deals where deleted_at is null and created_at>=${range.startInstant}::timestamptz and created_at<${range.endExclusive}::timestamptz`);
   const [a]=await tx.execute(sql`select
    count(*) filter(where status='planned' and type='follow_up' and (due_at at time zone 'Asia/Kolkata')::date=(${b.asOf}::timestamptz at time zone 'Asia/Kolkata')::date)::text today,
    count(*) filter(where status='planned' and type='follow_up' and (due_at at time zone 'Asia/Kolkata')::date>(${b.asOf}::timestamptz at time zone 'Asia/Kolkata')::date)::text upcoming,
    count(*) filter(where status='planned' and type='follow_up' and due_at<${b.asOf}::timestamptz)::text overdue,
    count(*) filter(where status='completed' and completed_at>=${range.startInstant}::timestamptz and completed_at<${range.endExclusive}::timestamptz)::text completed
    from public.activities where deleted_at is null`);
   const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(b.asOf));
   return {
    quotationHeaders:e.quotationCount===q.n&&e.quotationValue===q.v,
    quotationStatusCounts:sum(e.quotationStatuses,'count')===BigInt(q.n),
    quotationStatusValues:sum(e.quotationStatuses,'value')===BigInt(q.v),
    dealCohort:BigInt(e.valuedDealCount)+BigInt(e.unknownDealCount)===BigInt(b.dealCount),
    averageKnownValue:e.valuedDealCount===d.n&&dashboardDerived(b,e).averageDeal===(d.avg===null?null:BigInt(d.avg).toString()),
    attributedCash:sum(e.sourceCash,'amount')===BigInt(b.receipts),
    attributedPayments:sum(e.sourceCash,'receipts')===BigInt(b.receiptCount),
    todayFollowups:e.todayFollowups===a.today,upcomingFollowups:e.upcomingFollowups===a.upcoming,
    overdueFollowups:e.overdueFollowups===a.overdue,completedActivities:e.completedActivities===a.completed,
    queueLimits:[e.nextFollowups,e.attentionDeals,e.awaitingQuotes].every(r=>r.length<=8),
    queueTotals:BigInt(e.attentionDeals.length)<=BigInt(e.overdueDeals)&&BigInt(e.awaitingQuotes.length)<=BigInt(e.waitingQuotes),
    lateDealDates:e.attentionDeals.every(r=>r.expectedCloseDate<day),
    quotationValidity:e.awaitingQuotes.every(r=>r.validUntil===null||r.validUntil>=day),
    liveLeadCohort:BigInt(e.allLeads)>=BigInt(b.leadCount)
   };
  },{isolationLevel:'repeatable read',accessMode:'read only'});
  const passed=Object.values(checks).every(Boolean);console.log(JSON.stringify({connection,passed,checks}));if(!passed)process.exitCode=1;
 }catch{console.error(JSON.stringify({connection,passed:false,rawDetails:'suppressed'}));process.exitCode=1;}
 finally{if(client)await client.end({timeout:1});}
}
