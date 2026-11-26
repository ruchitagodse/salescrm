import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDeal, findDealForLead, listDeals, pipelineReady } from "@/lib/data";
import { DEAL_OUTCOMES, PIPELINE_STAGE_KEYS, PIPELINE_STAGE_LABELS } from "@/lib/deal-values";
import { entityIdSchema } from "@/lib/validation";
import { formatINR, paiseToRupees } from "@/lib/money";
import { RecordForm, DeleteForm } from "./form";
import { convertAction, deleteDealAction, moveDealAction, saveDealAction } from "./deal-actions";
import { dealFields, stageField } from "./deal-fields";
import { fieldValues, leadRecord, optionalRecord } from "./queries";
import { DateLabel, LoadingRecords, PageHeading, Pagination, SearchForm } from "./ui";
import type { DetailParams, SearchParams } from "./types";
import { RelatedActivities } from "./activity-pages";

function Unavailable() { return <section className="panel"><h1>Sales pipeline unavailable</h1><p>The pipeline is not ready yet. Contact the owner to complete setup.</p><Link href="/leads">Back to leads</Link></section>; }
const one = (query: Record<string, string | string[] | undefined>, key: string) => typeof query[key] === "string" ? query[key] as string : "";
const pageNumber = (value: string) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 1_000_000 ? Number(value) : 1;

async function DealList({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  if (!(await pipelineReady())) return <Unavailable />;
  const query = await searchParams;
  const search = one(query, "search").slice(0, 500);
  const outcome = DEAL_OUTCOMES.find((value) => value === one(query, "outcome"));
  const stageKey = PIPELINE_STAGE_KEYS.find((value) => value === one(query, "stageKey"));
  const result = await listDeals({ search, outcome, stageKey, page: pageNumber(one(query, "page")) });
  return <><PageHeading title="Deals" subtitle="Sales opportunities linked to your leads." /><section className="panel">
    <p><Link href="/pipeline">View pipeline</Link> · <Link href="/leads">Convert a lead to create a deal</Link></p>
    <SearchForm search={search}>
      <div className="field"><label htmlFor="deal-outcome">Outcome</label><select name="outcome" id="deal-outcome" defaultValue={outcome ?? ""}><option value="">All outcomes</option>{DEAL_OUTCOMES.map((value) => <option value={value} key={value}>{value}</option>)}</select></div>
      <div className="field"><label htmlFor="deal-stage">Stage</label><select name="stageKey" id="deal-stage" defaultValue={stageKey ?? ""}><option value="">All stages</option>{PIPELINE_STAGE_KEYS.map((value) => <option value={value} key={value}>{PIPELINE_STAGE_LABELS[value]}</option>)}</select></div>
    </SearchForm>
    {result.items.length ? <div className="table-scroll" role="region" aria-label="Deals" tabIndex={0}><table><caption className="sr-only">Deals, newest first</caption>
      <thead><tr><th scope="col">Deal</th><th scope="col">Contact</th><th scope="col">Stage</th><th scope="col">Outcome</th><th scope="col" className="money">Value</th><th scope="col">Expected close</th></tr></thead>
      <tbody>{result.items.map((deal) => <tr key={deal.id}><td><Link href={`/deals/${deal.id}`}>{deal.title}</Link></td><td><Link href={`/contacts/${deal.contactId}`}>{deal.contactName}</Link></td>
        <td>{PIPELINE_STAGE_LABELS[deal.stageKey]}</td><td><span className={`badge ${deal.outcome}`}>{deal.outcome}</span></td><td className="money">{formatINR(deal.valuePaise)}</td><td>{deal.expectedCloseDate || "—"}</td></tr>)}</tbody>
    </table></div> : <p className="empty-state">No deals match. Open a lead and choose Convert to deal.</p>}
    <Pagination base="/deals" {...result} filters={{ search, outcome: outcome ?? "", stageKey: stageKey ?? "" }} />
  </section></>;
}

async function Pipeline({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  if (!(await pipelineReady())) return <Unavailable />;
  const query = await searchParams;
  const search = one(query, "search").slice(0, 500);
  const outcome = DEAL_OUTCOMES.find((value) => value === one(query, "outcome")) ?? "open";
  const pages = Object.fromEntries(PIPELINE_STAGE_KEYS.map((key) => [key, pageNumber(one(query, `${key}Page`))]));
  const results = await Promise.all(PIPELINE_STAGE_KEYS.map((stageKey) => listDeals({ stageKey, search, outcome, page: pages[stageKey], pageSize: 10 })));
  return <><PageHeading title="Pipeline" subtitle="Discovery → Proposal → Negotiation. Won and lost are outcomes." />
    <section className="panel"><p><Link href="/deals">All deals</Link> · <Link href="/leads">Convert a lead</Link></p><SearchForm search={search}>
      <div className="field"><label htmlFor="pipeline-outcome">Outcome</label><select id="pipeline-outcome" name="outcome" defaultValue={outcome}>{DEAL_OUTCOMES.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
    </SearchForm></section>
    <div className="pipeline-board">{results.map((result, index) => {
      const key = PIPELINE_STAGE_KEYS[index];
      const href = (next: number) => {
        const params = new URLSearchParams({ search, outcome });
        for (const stage of PIPELINE_STAGE_KEYS) params.set(`${stage}Page`, String(stage === key ? next : pages[stage]));
        return `/pipeline?${params}`;
      };
      return <section className="pipeline-column" key={key} aria-labelledby={`stage-${key}`}><h2 id={`stage-${key}`}>{PIPELINE_STAGE_LABELS[key]} <small>{result.total}</small></h2>
        {!result.items.length && <p className="empty-state">No {outcome} deals on this page.</p>}
        {result.items.map((deal) => <article className="deal-card" key={deal.id}><h3><Link href={`/deals/${deal.id}`}>{deal.title}</Link></h3><p>{deal.contactName}</p>
          <p>{formatINR(deal.valuePaise)} · {deal.expectedCloseDate || "No close date"}</p>
          {outcome === "open" && <RecordForm action={moveDealAction.bind(null, deal.id)} fields={[stageField]} values={{ stageKey: key }} kind="deals" />}
        </article>)}
        <nav className="pagination" aria-label={`${PIPELINE_STAGE_LABELS[key]} pages`}><span>Page {result.page}</span>{result.page > 1 && <Link href={href(result.page - 1)}>Previous</Link>}{result.page * result.pageSize < result.total && <Link href={href(result.page + 1)}>Next</Link>}</nav>
      </section>;
    })}</div>
  </>;
}

async function Convert({ params }: { params: DetailParams }) {
  await requireUser();
  if (!(await pipelineReady())) return <Unavailable />;
  const { id } = await params;
  const lead = await leadRecord(id);
  const previous = await findDealForLead(id);
  if (previous) return <section className="panel"><h1>This lead already has a deal</h1>{previous.archived ? <p>Its deal was archived. A second deal cannot be created.</p> : <Link href={`/deals/${previous.id}`}>View existing deal</Link>}</section>;
  return <><PageHeading title="Convert lead to deal" /><section className="panel"><Link href={`/leads/${id}`}>Back to lead</Link><p>Conversion creates one deal and marks this lead converted together.</p>
    <RecordForm action={convertAction.bind(null, id)} fields={dealFields()} kind="deals" create
      values={{ title: lead.serviceNeeds || lead.sourceDetail || "New opportunity", stageKey: "discovery", valueRupees: lead.budgetPaise && !lead.budgetPaise.startsWith("-") ? paiseToRupees(lead.budgetPaise) : "", notes: lead.notes || "" }} />
  </section></>;
}

async function DealDetail({ params }: { params: DetailParams }) {
  await requireUser();
  if (!(await pipelineReady())) return <Unavailable />;
  const { id } = await params;
  if (!entityIdSchema.safeParse(id).success) notFound();
  const deal = await optionalRecord(() => getDeal(id));
  if (!deal) notFound();
  return <><PageHeading title={deal.title} /><section className="panel"><Link href="/deals">Back to deals</Link>
    <p><Link href={`/leads/${deal.leadId}`}>Source lead</Link> · <Link href={`/contacts/${deal.contactId}`}>{deal.contactName}</Link></p>
    <p><Link href={`/quotations/new?dealId=${deal.id}`}>Create quotation for this deal</Link></p>
    <p><span className={`badge ${deal.outcome}`}>{deal.outcome}</span> · {PIPELINE_STAGE_LABELS[deal.stageKey]} · {formatINR(deal.valuePaise)}</p>
    <div className="record-meta"><span>Created <DateLabel value={deal.createdAt} /></span><span>Updated <DateLabel value={deal.updatedAt} /></span></div>
    <RecordForm action={saveDealAction.bind(null, id)} fields={dealFields(true)} values={{ ...fieldValues(deal), valueRupees: paiseToRupees(deal.valuePaise) }} kind="deals" />
    <RelatedActivities type="deal" id={id} />
    <DeleteForm action={deleteDealAction.bind(null, id)} label="deal" />
  </section></>;
}
export function PipelinePage(props: { searchParams: SearchParams }) { return <Suspense fallback={<LoadingRecords />}><Pipeline {...props} /></Suspense>; }
export function DealListPage(props: { searchParams: SearchParams }) { return <Suspense fallback={<LoadingRecords />}><DealList {...props} /></Suspense>; }
export function DealDetailPage(props: { params: DetailParams }) { return <Suspense fallback={<LoadingRecords />}><DealDetail {...props} /></Suspense>; }
export function ConvertLeadPage(props: { params: DetailParams }) { return <Suspense fallback={<LoadingRecords />}><Convert {...props} /></Suspense>; }
