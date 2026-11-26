import { z } from "zod";
import type { AnalyticsRaw } from "./analytics-types.ts";
import { analyticsRange, exactRate, type AnalyticsRange } from "./analytics-values.ts";
import { LEAD_SOURCES, LEAD_STATUSES } from "./lead-values.ts";
import { PIPELINE_STAGE_KEYS, DEAL_OUTCOMES } from "./deal-values.ts";

export const ANALYST_FOCUS = ["overview", "sales", "cash"] as const;
export type AnalystFocus = typeof ANALYST_FOCUS[number];
export const analystInputSchema = z.object({start:z.string(),end:z.string(),focus:z.enum(ANALYST_FOCUS)}).strict();
export type AnalystFact = {id:string;label:string;scope:"selected_period"|"current_all_time";unit:"paise"|"count"|"percent";value:string};
export type AnalystSnapshot = {asOf:string;start:string;end:string;facts:AnalystFact[]};
export function analystInput(value:unknown,now:Date){
  const input=analystInputSchema.parse(value);
  const range=analyticsRange({start:input.start,end:input.end},now);
  return {...input,range};
}
const integer=z.string().max(100).regex(/^\d+$/);
// Copy only explicit aggregates and fixed categories. Never spread a source DTO.
export function analystSnapshot(report:AnalyticsRaw,range:AnalyticsRange):AnalystSnapshot{
  const facts:AnalystFact[]=[];
  const add=(id:string,label:string,value:string,unit:AnalystFact['unit']='count',scope:AnalystFact['scope']='selected_period')=>{
    facts.push({id,label,scope,unit,value:integer.parse(value)});
  };
  add('period.receipts','Recorded cash receipts',report.receipts,'paise');
  add('period.receipt_count','Recorded receipt count',report.receiptCount);
  add('period.expenses','Recorded expenses',report.expenses,'paise');
  add('period.expense_count','Recorded expense count',report.expenseCount);
  facts.push({id:'period.net_cash',label:'Net cash (receipts minus expenses)',scope:'selected_period',unit:'paise',value:(BigInt(report.receipts)-BigInt(report.expenses)).toString()});
  add('period.booked','Order value booked (header once per order)',report.bookedValue,'paise');
  add('period.order_count','Orders created',report.orderCount);
  add('period.leads','Leads created',report.leadCount);
  add('period.converted','Lead cohort with a live linked deal',report.convertedCount);
  facts.push({id:'period.conversion_rate',label:'Lead cohort conversion rate',scope:'selected_period',unit:'percent',value:exactRate(report.convertedCount,report.leadCount)});
  add('period.deals','Deals created',report.dealCount);
  const group=(prefix:string,label:string,allowed:readonly string[],rows:{key:string;count:string}[])=>{
    // Reject unexpected category text instead of exporting editable labels.
    if(rows.some(r=>!allowed.includes(r.key)))throw new RangeError('Invalid category');
    for(const key of allowed)add(`${prefix}.${key}`,`${label}: ${key}`,rows.find(r=>r.key===key)?.count ?? '0');
  };
  group('lead_source','Lead cohort source',LEAD_SOURCES,report.sources);
  group('lead_status','Lead cohort current status',LEAD_STATUSES,report.leadStatuses);
  group('deal_outcome','Deal cohort current outcome',DEAL_OUTCOMES,report.dealOutcomes);
  group('deal_stage','Deal cohort current stage',PIPELINE_STAGE_KEYS,report.dealStages);
  add('current.outstanding','Current outstanding balance',report.outstanding,'paise','current_all_time');
  add('current.outstanding_orders','Current orders with a balance',report.outstandingOrders,'count','current_all_time');
  add('current.pipeline','Current open pipeline known value',report.openPipeline,'paise','current_all_time');
  add('current.open_deals','Current open deal count',report.openDeals,'count','current_all_time');
  add('current.unvalued','Current open deals without a value',report.unknownValues,'count','current_all_time');
  return {asOf:z.iso.datetime({offset:true}).parse(report.asOf),start:range.start,end:range.end,facts};
}
const evidence=z.array(z.string().max(100)).min(1).max(5);
const finding=z.object({title:z.string().trim().min(1).max(160),detail:z.string().trim().min(1).max(900),evidenceIds:evidence}).strict();
export const analystOutputSchema=z.object({
  observations:z.array(finding).min(1).max(5),
  recommendations:z.array(z.object({title:z.string().trim().min(1).max(160),action:z.string().trim().min(1).max(900),priority:z.enum(['high','medium','low']),evidenceIds:evidence}).strict()).max(5),
  limitations:z.array(z.string().trim().min(1).max(500)).min(1).max(5),
}).strict();
export type AnalystOutput=z.output<typeof analystOutputSchema>;
export type AnalystResult={snapshot:AnalystSnapshot;report:AnalystOutput;focus:AnalystFocus;model:string;generatedAt:string};
export type AnalystState={message:string;result?:AnalystResult};
export function validateAnalystOutput(value:unknown,snapshot:AnalystSnapshot):AnalystOutput{
  const report=analystOutputSchema.parse(value);const known=new Set(snapshot.facts.map(f=>f.id));
  if([...report.observations,...report.recommendations].some(r=>r.evidenceIds.some(id=>!known.has(id))))throw new RangeError('Unknown evidence');
  return report;
}
