// Pure parameterized SQL builder; execution is exclusively server-side. Shared
// with the read-only/rollback verifiers so they exercise the production query.
import { sql } from "drizzle-orm";
import type { AnalyticsRange } from "./analytics-values.ts";
export function analyticsQuery(range: AnalyticsRange) {
  return sql`
    with valid_receipts as (
      select order_id,amount_paise,paid_on from public.payments where status='recorded' and deleted_at is null
    ), valid_expenses as (
      select amount_paise,spent_on from public.expenses where status='recorded' and deleted_at is null
    ), period_receipts as (
      select * from valid_receipts where paid_on >= ${range.start}::date and paid_on <= ${range.end}::date
    ), period_expenses as (
      select * from valid_expenses where spent_on >= ${range.start}::date and spent_on <= ${range.end}::date
    ), period_orders as (
      select id,total_paise from public.orders where deleted_at is null and created_at >= ${range.startInstant}::timestamptz and created_at < ${range.endExclusive}::timestamptz
    ), lead_cohort as (
      select id,source,status from public.leads where deleted_at is null and created_at >= ${range.startInstant}::timestamptz and created_at < ${range.endExclusive}::timestamptz
    ), deal_cohort as (
      select d.id,d.outcome,s.key as stage_key from public.deals d join public.pipeline_stages s on s.id=d.stage_id
      where d.deleted_at is null and d.created_at >= ${range.startInstant}::timestamptz and d.created_at < ${range.endExclusive}::timestamptz
    ), receipt_months as (
      select to_char(paid_on,'YYYY-MM') as month,sum(amount_paise) as amount from period_receipts group by 1
    ), expense_months as (
      select to_char(spent_on,'YYYY-MM') as month,sum(amount_paise) as amount from period_expenses group by 1
    ), monthly as (
      select coalesce(r.month,e.month) as month,coalesce(r.amount,0)::text as receipts,coalesce(e.amount,0)::text as expenses
      from receipt_months r full outer join expense_months e on e.month=r.month
    ), paid_by_order as (
      select order_id,sum(amount_paise) as paid from valid_receipts group by order_id
    ), balances as (
      select o.id,o.number,o.title,o.customer_name,o.created_at,o.total_paise,coalesce(p.paid,0) as paid,
        o.total_paise-coalesce(p.paid,0) as balance
      from public.orders o left join paid_by_order p on p.order_id=o.id where o.deleted_at is null
    ), open_pipeline as (
      select d.value_paise,s.key from public.deals d join public.pipeline_stages s on s.id=d.stage_id where d.deleted_at is null and d.outcome='open'
    )
    select json_build_object(
      'asOf',current_timestamp,
      'receipts',(select coalesce(sum(amount_paise),0)::text from period_receipts),
      'receiptCount',(select count(*)::text from period_receipts),
      'expenses',(select coalesce(sum(amount_paise),0)::text from period_expenses),
      'expenseCount',(select count(*)::text from period_expenses),
      'bookedValue',(select coalesce(sum(total_paise),0)::text from period_orders),
      'orderCount',(select count(*)::text from period_orders),
      'leadCount',(select count(*)::text from lead_cohort),
      'convertedCount',(select count(*)::text from lead_cohort l where exists(select 1 from public.deals d where d.lead_id=l.id and d.deleted_at is null)),
      'dealCount',(select count(*)::text from deal_cohort),
      'sources',coalesce((select json_agg(json_build_object('key',source,'count',n::text) order by source) from (select source,count(*) n from lead_cohort group by source) x),'[]'::json),
      'leadStatuses',coalesce((select json_agg(json_build_object('key',status,'count',n::text) order by status) from (select status,count(*) n from lead_cohort group by status) x),'[]'::json),
      'dealOutcomes',coalesce((select json_agg(json_build_object('key',outcome,'count',n::text) order by outcome) from (select outcome,count(*) n from deal_cohort group by outcome) x),'[]'::json),
      'dealStages',coalesce((select json_agg(json_build_object('key',stage_key,'count',n::text) order by stage_key) from (select stage_key,count(*) n from deal_cohort group by stage_key) x),'[]'::json),
      'monthly',coalesce((select json_agg(json_build_object('month',month,'receipts',receipts,'expenses',expenses) order by month) from monthly),'[]'::json),
      'outstanding',(select coalesce(sum(balance),0)::text from balances),
      'outstandingOrders',(select count(*)::text from balances where balance>0),
      'balances',coalesce((select json_agg(json_build_object('id',id,'number',number::text,'title',title,'customerName',customer_name,'total',total_paise::text,'paid',paid::text,'balance',balance::text) order by created_at,id)
        from (select * from balances where balance>0 order by created_at,id limit 10) b),'[]'::json),
      'openPipeline',(select coalesce(sum(value_paise),0)::text from open_pipeline),
      'openDeals',(select count(*)::text from open_pipeline),
      'unknownValues',(select count(*)::text from open_pipeline where value_paise is null),
      'pipeline',coalesce((select json_agg(json_build_object('key',key,'count',n::text,'value',value::text,'unknown',unknown::text) order by key)
        from (select key,count(*) n,coalesce(sum(value_paise),0) value,count(*) filter(where value_paise is null) unknown from open_pipeline group by key) p),'[]'::json)
    ) as report
  `;
}
