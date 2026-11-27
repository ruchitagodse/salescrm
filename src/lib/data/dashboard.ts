import 'server-only';
import {analyticsRange,cashSeries,exactRate} from '@/lib/analytics-values';
import {analyticsQuery} from '@/lib/analytics-query';
import type {AnalyticsRaw} from '@/lib/analytics-types';
import {dashboardQuery} from '@/lib/dashboard-query';
import {dashboardDerived,type DashboardExtra} from '@/lib/dashboard-values';
import {withData,DataError} from './shared';
export async function getDashboard(input:unknown={}){
 return withData(async db=>{
  let range;try{range=analyticsRange(input,new Date());}catch{throw new DataError('INVALID_INPUT');}
  return db.transaction(async tx=>{
   const [{report:base}]=await tx.execute<{report:AnalyticsRaw}>(analyticsQuery(range));
   const [{report:extra}]=await tx.execute<{report:DashboardExtra}>(dashboardQuery(range,new Date(base.asOf)));
   return {base,extra,range,derived:dashboardDerived(base,extra),monthly:cashSeries(range.months,base.monthly),
    netCash:(BigInt(base.receipts)-BigInt(base.expenses)).toString(),conversionRate:exactRate(base.convertedCount,base.leadCount)};
  },{isolationLevel:'repeatable read',accessMode:'read only'});
 });
}
