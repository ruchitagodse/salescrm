"use client";
import { useActionState } from "react";
import { generateAnalysis } from "./analyst-actions";
import { ANALYST_FOCUS, type AnalystSnapshot, type AnalystFact } from "@/lib/analyst-values";
import { formatINR } from "@/lib/money";
import { formatCount } from "@/lib/analytics-values";
function value(fact:AnalystFact){return fact.unit==='paise'?formatINR(fact.value):fact.unit==='count'?formatCount(fact.value):fact.value;}
function Evidence({ids,snapshot}:{ids:string[];snapshot:AnalystSnapshot}){
  return <ul className="analyst-evidence" aria-label="Supporting facts">{ids.map((id,i)=>{
    const fact=snapshot.facts.find(f=>f.id===id);return fact?<li key={`${id}-${i}`}>{fact.label}: <strong>{value(fact)}</strong> ({fact.scope==='selected_period'?'selected period':'current · all dates'})</li>:null;
  })}</ul>;
}
export function AnalystFacts({snapshot}:{snapshot:AnalystSnapshot}){
  return <details><summary>Exact aggregate facts eligible for analysis</summary><p>Selected period: {snapshot.start} through {snapshot.end}, India time. Current snapshots use all dates. Snapshot: {snapshot.asOf}.</p>
    <div className="table-wrap"><table><caption>Authoritative aggregate figures · INR where monetary</caption><thead><tr><th scope="col">Metric</th><th scope="col">Scope</th><th scope="col">Value</th></tr></thead><tbody>{snapshot.facts.map(f=><tr key={f.id}><th scope="row">{f.label}</th><td>{f.scope==='selected_period'?'Selected period':'Current · all dates'}</td><td>{value(f)}</td></tr>)}</tbody></table></div>
  </details>;
}
export function AnalystForm({snapshot,available}:{snapshot:AnalystSnapshot;available:boolean}){
  const [state,action,pending]=useActionState(generateAnalysis,{message:''});const result=state.result;
  return <>
    <AnalystFacts snapshot={snapshot}/>
    <form action={action} className="list-filters">
      <input type="hidden" name="start" value={snapshot.start}/><input type="hidden" name="end" value={snapshot.end}/>
      <div className="field"><label htmlFor="analyst-focus">Analysis focus</label><select id="analyst-focus" name="focus" disabled={pending}>{ANALYST_FOCUS.map(f=><option key={f} value={f}>{f[0].toUpperCase()+f.slice(1)}</option>)}</select></div>
      <button disabled={!available||pending}>{pending?'Generating…':'Generate with Gemini'}</button>
    </form>
    <p className="muted">Generating sends aggregate figures and category counts to Google Gemini. No names, contact details, messages or notes are sent. It may use your provider quota. Figures are refreshed on generation; reports are not saved by OS.</p>
    <p role="status" aria-live="polite">{pending?'Generating analysis. No CRM records will be changed.':state.message}</p>
    {result&&<section aria-labelledby="analyst-report-title" aria-busy={pending}>
      <h2 id="analyst-report-title">AI analysis · {result.focus}</h2>
      <p>{result.snapshot.start} through {result.snapshot.end} · Model: {result.model} · Generated: <time dateTime={result.generatedAt}>{result.generatedAt}</time></p>
      <p className="panel">AI suggestions need your review. Evidence references are checked; the interpretation may still be wrong. Exact figures below remain authoritative. This is not a profit report or a forecast.</p>
      <h3>Observations</h3>{result.report.observations.map((r,i)=><article className="panel analyst-finding" key={i}><h4>{r.title}</h4><p>{r.detail}</p><Evidence ids={r.evidenceIds} snapshot={result.snapshot}/></article>)}
      <h3>Suggested actions</h3>{result.report.recommendations.length?result.report.recommendations.map((r,i)=><article className="panel analyst-finding" key={i}><h4>{r.title}</h4><p>Suggested priority: {r.priority}</p><p>{r.action}</p><Evidence ids={r.evidenceIds} snapshot={result.snapshot}/></article>):<p>No specific action suggested.</p>}
      <h3>Data limitations</h3><ul>{result.report.limitations.map((r,i)=><li key={i}>{r}</li>)}</ul>
      <p>These aggregates contain no prior-period comparison, activity deadlines, historical stage changes or customer-level context. Suggestions do not create tasks or change records.</p>
      <AnalystFacts snapshot={result.snapshot}/>
    </section>}
  </>;
}
