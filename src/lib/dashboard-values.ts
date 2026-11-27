import type { AnalyticsRaw } from './analytics-types.ts';
import { exactRate } from './analytics-values.ts';
export type DashboardExtra={
  quotationCount:string;quotationValue:string;quotationStatuses:{key:string;count:string;value:string}[];
  valuedDealCount:string;dealValue:string;unknownDealCount:string;
  allLeads:string;contacts:string;companies:string;newLeads:string;
  todayFollowups:string;upcomingFollowups:string;overdueFollowups:string;completedActivities:string;
  overdueDeals:string;waitingQuotes:string;pastValidity:string;
  sourceCash:{source:string;amount:string;receipts:string;orders:string}[];
  nextFollowups:{id:string;title:string;dueAt:string;targetType:'lead'|'deal'|'contact';targetId:string}[];
  attentionDeals:{id:string;title:string;expectedCloseDate:string;value:string|null}[];
  awaitingQuotes:{id:string;number:string;title:string;total:string;createdAt:string;validUntil:string|null}[];
};
export function averagePaise(total:string,count:string):string|null{
 const sum=BigInt(total),n=BigInt(count);if(sum<BigInt(0)||n<BigInt(0))throw new RangeError('Invalid amounts');
 return n===BigInt(0)?null:((sum+n/BigInt(2))/n).toString();
}
export function dashboardDerived(base:AnalyticsRaw,extra:DashboardExtra){
 const won=base.dealOutcomes.find(r=>r.key==='won')?.count??'0';
 const lost=base.dealOutcomes.find(r=>r.key==='lost')?.count??'0';
 const ordered=[...extra.sourceCash].filter(r=>r.source!=='unattributed'&&BigInt(r.amount)>BigInt(0)).sort((a,b)=>{
  const x=BigInt(a.amount),y=BigInt(b.amount);return x===y?a.source.localeCompare(b.source):x>y?-1:1;
 });
 return {averageDeal:averagePaise(extra.dealValue,extra.valuedDealCount),won,lost,
  wonShare:exactRate(won,(BigInt(won)+BigInt(lost)).toString()),
  topSources:ordered.length?ordered.filter(r=>r.amount===ordered[0].amount).map(r=>r.source):[],
 };
}
