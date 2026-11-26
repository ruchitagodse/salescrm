import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { findDealForLead, getContact, listLeads, pipelineReady } from "@/lib/data";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/lib/lead-values";
import { formatINR, paiseToRupees } from "@/lib/money";
import { NewLeadForm } from "./new-lead-form";
import { DeleteForm, RecordForm } from "./form";
import { leadFields } from "./lead-fields";
import { saveLead } from "./lead-actions";
import { deleteRecord } from "./record-actions";
import { companyOptions, fieldValues, leadRecord, optionalRecord } from "./queries";
import { DateLabel, listQuery, LoadingRecords, PageHeading, Pagination, SearchForm } from "./ui";
import type { DetailParams, SearchParams } from "./types";
import { RelatedActivities } from "./activity-pages";

async function LeadList({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const query = await listQuery(searchParams);
  const source = LEAD_SOURCES.find((value) => value === query.source);
  const status = LEAD_STATUSES.find((value) => value === query.status);
  const result = await listLeads({ search: query.search, page: query.page, source, status });
  return <><PageHeading title="Leads" subtitle="Every enquiry, from first contact to conversion." createHref="/leads/new" />
    <section className="panel"><SearchForm search={query.search}>
      <div className="field"><label htmlFor="status-filter">Status</label><select name="status" id="status-filter" defaultValue={status ?? ""}>
        <option value="">All statuses</option>{LEAD_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
      <div className="field"><label htmlFor="source-filter">Source</label><select name="source" id="source-filter" defaultValue={source ?? ""}>
        <option value="">All sources</option>{LEAD_SOURCES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></div>
    </SearchForm>
      {result.items.length ? <div className="table-scroll" role="region" aria-label="Leads" tabIndex={0}><table>
        <caption className="sr-only">Leads, newest first</caption><thead><tr><th scope="col">Enquiry</th><th scope="col">Contact</th><th scope="col">Status</th><th scope="col">Source</th><th scope="col" className="money">Budget</th><th scope="col">Added</th></tr></thead>
        <tbody>{result.items.map((lead) => <tr key={lead.id}>
          <td><Link href={`/leads/${lead.id}`}>{lead.serviceNeeds || lead.sourceDetail || "View enquiry"}</Link></td>
          <td><Link href={`/contacts/${lead.contactId}`}>{lead.contactName}</Link></td>
          <td><span className={`badge ${lead.status}`}>{lead.status}</span></td><td>{lead.source.replaceAll("_", " ")}</td>
          <td className="money">{formatINR(lead.budgetPaise)}</td><td><DateLabel value={lead.createdAt} /></td>
        </tr>)}</tbody>
      </table></div> : <p className="empty-state">No leads found. <Link href="/leads/new">Add an enquiry</Link> or change the filters.</p>}
      <Pagination base="/leads" {...result} filters={{ search: query.search, source: source ?? "", status: status ?? "" }} />
    </section></>;
}
async function LeadCreate() {
  await requireUser();
  const options = await companyOptions();
  return <><PageHeading title="New enquiry" subtitle="Add a person and their requirement in one step." /><section className="panel">
    <Link href="/leads">Back to leads</Link><NewLeadForm companies={options} />
  </section></>;
}
async function LeadDetail({ params }: { params: DetailParams }) {
  await requireUser();
  const { id } = await params;
  const lead = await leadRecord(id);
  const contact = await optionalRecord(() => getContact(lead.contactId));
  const ready = await pipelineReady();
  const deal = ready ? await findDealForLead(id) : null;
  return <><PageHeading title={lead.serviceNeeds || "Lead details"} /><section className="panel">
    <Link href="/leads">Back to leads</Link>
    {ready && <p>{deal ? deal.archived ? "This lead's deal is archived; another cannot be created." : <Link href={`/deals/${deal.id}`}>View deal</Link> : <Link className="button-link" href={`/leads/${id}/convert`}>Convert to deal</Link>}</p>}
    <p>Contact: <Link href={`/contacts/${lead.contactId}`}>{contact?.fullName ?? "View linked contact"}</Link>{!contact && " (unavailable)"}</p>
    <p><span className={`badge ${lead.status}`}>{lead.status}</span> · Budget {formatINR(lead.budgetPaise)} · Entry: {lead.entryMethod}</p>
    <div className="record-meta"><span>Created <DateLabel value={lead.createdAt} /></span><span>Updated <DateLabel value={lead.updatedAt} /></span>
      {lead.convertedAt && <span>Converted <DateLabel value={lead.convertedAt} /></span>}</div>
    <h2>Edit enquiry</h2><RecordForm action={saveLead.bind(null, id)} fields={leadFields(true)}
      values={{ ...fieldValues(lead), budgetRupees: paiseToRupees(lead.budgetPaise) }} kind="leads" />
    <RelatedActivities type="lead" id={id} />
    <DeleteForm action={deleteRecord.bind(null, "leads", id)} label="lead" />
  </section></>;
}
export function LeadListPage(props: { searchParams: SearchParams }) { return <Suspense fallback={<LoadingRecords />}><LeadList {...props} /></Suspense>; }
export function LeadNewPage() { return <Suspense fallback={<LoadingRecords />}><LeadCreate /></Suspense>; }
export function LeadDetailPage(props: { params: DetailParams }) { return <Suspense fallback={<LoadingRecords />}><LeadDetail {...props} /></Suspense>; }
