import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { integrationsReady, listIntegrationEvents } from "@/lib/data/integrations";
import { integrationStatus } from "@/lib/integrations/config";
import { IntegrationRetry } from "../_crm/integration-retry";
import { LoadingRecords, PageHeading, Pagination, listQuery } from "../_crm/ui";
import type { SearchParams } from "../_crm/types";
async function IntegrationList({searchParams}:{searchParams:SearchParams}){
  await requireUser();
  const ready=await integrationsReady();
  const query=await listQuery(searchParams);
  const status=integrationStatus();
  return <><PageHeading title="Integrations" subtitle="Inbound Meta lead forms, Instagram and WhatsApp. No outbound messages are sent."/>
    <section className="panel"><h2>Connection setup</h2><p>Configuration presence does not verify permissions, account ownership, callback subscriptions or live delivery.</p>
      {status.map(s=><details key={s.channel}><summary>{s.channel}: {s.variables.every(v=>v.present)?'configuration present':'setup incomplete'}</summary><ul>{s.variables.map(v=><li key={v.name}>{v.name}: {v.present?'present':'missing'}</li>)}</ul></details>)}
    </section>
    {!ready?<p role="status">Integration database setup is pending. Contact the owner.</p>:await (async()=>{
      const result=await listIntegrationEvents(query.page);
      return <><p>First successfully processed message per account-scoped sender creates a lead. Later messages link to that lead. Meta form submissions each create a lead. No contact merges are performed.</p>
        <div className="table-wrap"><table><caption>Recent inbound events · newest received first</caption><thead><tr><th scope="col">Received / provider time</th><th scope="col">Channel / kind</th><th scope="col">Sender / message</th><th scope="col">State</th><th scope="col">Lead / action</th></tr></thead><tbody>
          {result.items.map(e=><tr key={e.id}><td><time dateTime={e.createdAt.toISOString()}>{e.createdAt.toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</time><br/><small>Provider: {e.occurredAt.toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</small></td><td>{e.channel}<br/>{e.kind}<details><summary>Attribution</summary><p>Account: {e.accountId}</p><p>Event: {e.externalId}</p>{e.formId&&<p>Form: {e.formId}</p>}{e.adId&&<p>Ad: {e.adId}</p>}</details></td><td>{e.displayName || e.senderId || 'Lead form'}<p className="integration-message">{e.body || 'No text content stored.'}</p></td><td>{e.state.replaceAll('_',' ')}{e.errorCode&&<p>{e.errorCode}</p>}</td><td>{e.leadId?<Link href={`/leads/${e.leadId}`}>Open lead</Link>:<IntegrationRetry id={e.id}/>}</td></tr>)}
          {!result.items.length&&<tr><td colSpan={5}>No verified inbound events received yet.</td></tr>}
        </tbody></table></div><Pagination base="/integrations" {...result}/></>;
    })()}
  </>;
}
export default function IntegrationsPage(props:{searchParams:SearchParams}){return <Suspense fallback={<LoadingRecords/>}><IntegrationList {...props}/></Suspense>;}
