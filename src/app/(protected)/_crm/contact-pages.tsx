import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCompany, listContacts, listLeads } from "@/lib/data";
import { contactFields } from "./fields";
import { DeleteForm, RecordForm } from "./form";
import { deleteRecord, saveContact } from "./record-actions";
import { companyOptions, contactRecord, fieldValues, optionalRecord } from "./queries";
import { DateLabel, listQuery, LoadingRecords, PageHeading, Pagination, SearchForm } from "./ui";
import type { DetailParams, SearchParams } from "./types";

async function ContactList({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const { search, page } = await listQuery(searchParams);
  const result = await listContacts({ search, page });
  return <><PageHeading title="Contacts" subtitle="People, conversations and future opportunities." createHref="/contacts/new" />
    <section className="panel"><SearchForm search={search} />
      {result.items.length ? <div className="table-scroll" role="region" aria-label="Contacts" tabIndex={0}><table>
        <caption className="sr-only">Contacts, newest first</caption><thead><tr><th scope="col">Name</th><th scope="col">Phone</th><th scope="col">Email</th><th scope="col">City</th></tr></thead>
        <tbody>{result.items.map((contact) => <tr key={contact.id}><td><Link href={`/contacts/${contact.id}`}>{contact.fullName}</Link></td><td>{contact.phone || "—"}</td><td>{contact.email || "—"}</td><td>{contact.city || "—"}</td></tr>)}</tbody>
      </table></div> : <p className="empty-state">No contacts found. <Link href="/contacts/new">Add a contact</Link> or change your search.</p>}
      <Pagination base="/contacts" {...result} filters={{ search }} />
    </section></>;
}
async function ContactCreate() {
  await requireUser();
  const options = await companyOptions();
  return <><PageHeading title="New contact" /><section className="panel"><Link href="/contacts">Back to contacts</Link>
    <RecordForm action={saveContact.bind(null, null)} fields={contactFields(options)} kind="contacts" create />
  </section></>;
}
async function ContactDetail({ params, searchParams }: { params: DetailParams; searchParams: SearchParams }) {
  await requireUser();
  const { id } = await params;
  const contact = await contactRecord(id);
  const { page } = await listQuery(searchParams);
  const [options, company, related] = await Promise.all([
    companyOptions(), contact.companyId ? optionalRecord(() => getCompany(contact.companyId!)) : null,
    listLeads({ contactId: id, page }),
  ]);
  if (contact.companyId && !options.some((option) => option.value === contact.companyId)) {
    options.push({ value: contact.companyId, label: "Linked company (unavailable)" });
  }
  return <><PageHeading title={contact.fullName} /><section className="panel"><Link href="/contacts">Back to contacts</Link>
    <p>Company: {company ? <Link href={`/companies/${company.id}`}>{company.name}</Link> : contact.companyId ? "Linked company is unavailable." : "No company"}</p>
    <div className="record-meta"><span>Created <DateLabel value={contact.createdAt} /></span><span>Updated <DateLabel value={contact.updatedAt} /></span></div>
    <h2>Contact details</h2><RecordForm action={saveContact.bind(null, id)} fields={contactFields(options)} values={fieldValues(contact)} kind="contacts" />
    <section className="related-records"><h2>Leads for this contact</h2>
      {related.items.length ? <div className="table-scroll" role="region" aria-label="Contact leads" tabIndex={0}><table><caption className="sr-only">Leads for {contact.fullName}</caption>
        <thead><tr><th scope="col">Lead</th><th scope="col">Status</th><th scope="col">Created</th></tr></thead><tbody>
          {related.items.map((lead) => <tr key={lead.id}><td><Link href={`/leads/${lead.id}`}>{lead.sourceDetail || lead.serviceNeeds || lead.source}</Link></td><td><span className={`badge ${lead.status}`}>{lead.status}</span></td><td><DateLabel value={lead.createdAt} /></td></tr>)}
        </tbody></table></div> : <p className="empty-state">No leads for this contact yet.</p>}
      <Pagination base={`/contacts/${id}`} {...related} />
    </section>
    <DeleteForm action={deleteRecord.bind(null, "contacts", id)} label="contact" />
  </section></>;
}
export function ContactListPage(props: { searchParams: SearchParams }) { return <Suspense fallback={<LoadingRecords />}><ContactList {...props} /></Suspense>; }
export function ContactNewPage() { return <Suspense fallback={<LoadingRecords />}><ContactCreate /></Suspense>; }
export function ContactDetailPage(props: { params: DetailParams; searchParams: SearchParams }) { return <Suspense fallback={<LoadingRecords />}><ContactDetail {...props} /></Suspense>; }
