import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAnalytics } from "@/lib/data/analytics";
import { analyticsRange } from "@/lib/analytics-values";
import { analystSnapshot } from "@/lib/analyst-values";
import { analystConfigStatus } from "@/lib/ai/config";
import { AnalystForm } from "../_crm/analyst-form";
import { LoadingRecords, PageHeading } from "../_crm/ui";
import type { SearchParams } from "../_crm/types";
function Dates({start,end}:{start?:string;end?:string}){
  return <form method="get" className="list-filters"><div className="field"><label htmlFor="ai-start">From (India)</label><input id="ai-start" name="start" type="date" defaultValue={start} required/></div><div className="field"><label htmlFor="ai-end">Through (inclusive)</label><input id="ai-end" name="end" type="date" defaultValue={end} required/></div><button>Preview period</button><Link href="/analyst">Month to date</Link></form>;
}
async function Analyst({searchParams}:{searchParams:SearchParams}){
  await requireUser();const params=await searchParams;let range;
  try{range=analyticsRange({...(params.start===undefined?{}:{start:params.start}),...(params.end===undefined?{}:{end:params.end})},new Date());}
  catch{return <><PageHeading title="AI Analyst"/><Dates/><p role="alert">Choose two valid dates in order, no more than 3,660 days apart.</p></>;}
  const snapshot=analystSnapshot(await getAnalytics({start:range.start,end:range.end}),range);
  const status=analystConfigStatus();
  return <><PageHeading title="AI Analyst" subtitle="On-demand observations and suggested actions from your aggregate analytics."/>
    <Dates start={range.start} end={range.end}/>
    <p>Selected-period cash/bookings and lead/deal creation cohorts are separate from current all-time outstanding/pipeline. Voids and deletions revise the figures. <Link href="/analytics">View analytics</Link>.</p>
    {!status.ready&&<section className="panel"><h2>Gemini setup pending</h2><p>Owner setup is required before generation. Aggregate preview is available.</p><p>GEMINI_API_KEY: {status.keyPresent?'present':'missing'} · GEMINI_MODEL: {status.modelPresent?'present':'missing'}</p><p>Presence does not verify model availability, key validity, billing or quota.</p></section>}
    <AnalystForm key={`${range.start}/${range.end}`} snapshot={snapshot} available={status.ready}/>
  </>;
}
export default function AnalystPage(props:{searchParams:SearchParams}){return <Suspense fallback={<LoadingRecords/>}><Analyst {...props}/></Suspense>;}
