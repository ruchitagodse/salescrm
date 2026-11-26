import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listCompanies } from "@/lib/data";
import { companyFields } from "./fields";
import { DeleteForm, RecordForm } from "./form";
import { deleteRecord, saveCompany } from "./record-actions";
import { companyRecord, fieldValues } from "./queries";
import { DateLabel, listQuery, LoadingRecords, PageHeading, Pagination, SearchForm } from "./ui";
import type { DetailParams, SearchParams } from "./types";

async function CompanyList({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const { search, page } = await listQuery(searchParams);
  const result = await listCompanies({ search, page });
  return <><PageHeading title="Companies" subtitle="The businesses behind your relationships." createHref="/companies/new" />
    <section className="panel"><SearchForm search={search} />
      {result.items.length ? <div className="table-scroll" role="region" aria-label="Companies" tabIndex={0}><table>
        <caption className="sr-only">Companies, newest first</caption><thead><tr><th scope="col">Company</th><th scope="col">Industry</th><th scope="col">City</th><th scope="col">Added</th></tr></thead>
        <tbody>{result.items.map((company) => <tr key={company.id}><td><Link href={`/companies/${company.id}`}>{company.name}</Link></td><td>{company.industry || "—"}</td><td>{company.city || "—"}</td><td><DateLabel value={company.createdAt} /></td></tr>)}</tbody>
      </table></div> : <p className="empty-state">No companies found. <Link href="/companies/new">Add a company</Link> or change your search.</p>}
      <Pagination base="/companies" {...result} filters={{ search }} />
    </section></>;
}
async function CompanyCreate() {
  await requireUser();
  return <><PageHeading title="New company" /><section className="panel"><Link href="/companies">Back to companies</Link>
    <RecordForm action={saveCompany.bind(null, null)} fields={companyFields} kind="companies" create />
  </section></>;
}
async function CompanyDetail({ params }: { params: DetailParams }) {
  await requireUser();
  const { id } = await params;
  const company = await companyRecord(id);
  return <><PageHeading title={company.name} /><section className="panel"><Link href="/companies">Back to companies</Link>
    <div className="record-meta"><span>Created <DateLabel value={company.createdAt} /></span><span>Updated <DateLabel value={company.updatedAt} /></span></div>
    <h2>Company details</h2><RecordForm action={saveCompany.bind(null, id)} fields={companyFields} values={fieldValues(company)} kind="companies" />
    <DeleteForm action={deleteRecord.bind(null, "companies", id)} label="company" />
  </section></>;
}
export function CompanyListPage(props: { searchParams: SearchParams }) { return <Suspense fallback={<LoadingRecords />}><CompanyList {...props} /></Suspense>; }
export function CompanyNewPage() { return <Suspense fallback={<LoadingRecords />}><CompanyCreate /></Suspense>; }
export function CompanyDetailPage(props: { params: DetailParams }) { return <Suspense fallback={<LoadingRecords />}><CompanyDetail {...props} /></Suspense>; }
