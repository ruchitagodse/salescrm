import {sql} from 'drizzle-orm';
import type {AnalyticsRange} from './analytics-values.ts';
import {activityWindow,indiaLocalInput} from './activity-time.ts';
export function dashboardQuery(range:AnalyticsRange,now:Date){
 const today=activityWindow('today',now);const day=indiaLocalInput(now).slice(0,10);
 return sql`
 with period_quotes as (
  select id,total_paise,status from public.quotations where deleted_at is null and created_at>=${range.startInstant}::timestamptz and created_at<${range.endExclusive}::timestamptz
 ), period_deals as (
  select value_paise from public.deals where deleted_at is null and created_at>=${range.startInstant}::timestamptz and created_at<${range.endExclusive}::timestamptz
 ), followups as (
  select * from public.activities where deleted_at is null and status='planned' and type='follow_up'
 ), late_deals as (
  select id,title,expected_close_date,value_paise from public.deals where deleted_at is null and outcome='open' and expected_close_date<${day}::date
 ), waiting_quotes as (
  select id,number,title,total_paise,created_at,valid_until from public.quotations where deleted_at is null and status='sent' and (valid_until is null or valid_until>=${day}::date)
 ), attributed_cash as (
  select coalesce(l.source,'unattributed') as source,p.amount_paise,o.id as order_id
  from public.payments p
  left join public.orders o on o.id=p.order_id and o.deleted_at is null
  left join public.quotations q on q.id=o.quotation_id and q.deleted_at is null
  left join public.deals d on d.id=q.deal_id and d.deleted_at is null
  left join public.leads l on l.id=coalesce(q.lead_id,d.lead_id) and l.deleted_at is null
  where p.deleted_at is null and p.status='recorded' and p.paid_on>=${range.start}::date and p.paid_on<=${range.end}::date
 )
 select json_build_object(
  'quotationCount',(select count(*)::text from period_quotes),
  'quotationValue',(select coalesce(sum(total_paise),0)::text from period_quotes),
  'quotationStatuses',coalesce((select json_agg(json_build_object('key',status,'count',n::text,'value',v::text) order by status) from (select status,count(*) n,coalesce(sum(total_paise),0) v from period_quotes group by status) x),'[]'::json),
  'valuedDealCount',(select count(value_paise)::text from period_deals),
  'dealValue',(select coalesce(sum(value_paise),0)::text from period_deals),
  'unknownDealCount',(select count(*)::text from period_deals where value_paise is null),
  'allLeads',(select count(*)::text from public.leads where deleted_at is null),
  'contacts',(select count(*)::text from public.contacts where deleted_at is null),
  'companies',(select count(*)::text from public.companies where deleted_at is null),
  'newLeads',(select count(*)::text from public.leads where deleted_at is null and status='new'),
  'todayFollowups',(select count(*)::text from followups where due_at>=${today.from!.toISOString()}::timestamptz and due_at<${today.before!.toISOString()}::timestamptz),
  'upcomingFollowups',(select count(*)::text from followups where due_at>=${today.before!.toISOString()}::timestamptz),
  'overdueFollowups',(select count(*)::text from followups where due_at<${now.toISOString()}::timestamptz),
  'completedActivities',(select count(*)::text from public.activities where deleted_at is null and status='completed' and completed_at>=${range.startInstant}::timestamptz and completed_at<${range.endExclusive}::timestamptz),
  'overdueDeals',(select count(*)::text from late_deals),
  'waitingQuotes',(select count(*)::text from waiting_quotes),
  'pastValidity',(select count(*)::text from public.quotations where deleted_at is null and status in ('draft','sent') and valid_until<${day}::date),
  'sourceCash',coalesce((select json_agg(json_build_object('source',source,'amount',amount::text,'receipts',receipts::text,'orders',orders::text) order by amount desc,source) from
    (select source,sum(amount_paise) amount,count(*) receipts,count(distinct order_id) orders from attributed_cash group by source) a),'[]'::json),
  'nextFollowups',coalesce((select json_agg(json_build_object('id',id,'title',title,'dueAt',due_at,'targetType',case when lead_id is not null then 'lead' when deal_id is not null then 'deal' else 'contact' end,'targetId',coalesce(lead_id,deal_id,contact_id)) order by due_at,id)
    from (select * from followups order by due_at,id limit 8) x),'[]'::json),
  'attentionDeals',coalesce((select json_agg(json_build_object('id',id,'title',title,'expectedCloseDate',expected_close_date,'value',value_paise::text) order by expected_close_date,id)
    from (select * from late_deals order by expected_close_date,id limit 8) x),'[]'::json),
  'awaitingQuotes',coalesce((select json_agg(json_build_object('id',id,'number',number::text,'title',title,'total',total_paise::text,'createdAt',created_at,'validUntil',valid_until) order by created_at,id)
    from (select * from waiting_quotes order by created_at,id limit 8) x),'[]'::json)
 ) as report`;
}
