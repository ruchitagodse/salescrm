import 'server-only';
import {z} from 'zod';
import {eq,sql} from 'drizzle-orm';
import {quotationDeliveries} from '@/db/schema';
import {all,withData} from './shared';
const statuses=z.array(z.object({id:z.string().min(1).max(512),status:z.enum(['sent','delivered','read','failed']),timestamp:z.string().regex(/^\d+$/)})).max(1000);
// Called only after provider HMAC and account validation, never from the browser.
export async function recordWhatsAppStatuses(payload:unknown,accountId:string){
 const parsed=z.object({entry:z.array(z.object({changes:z.array(z.object({field:z.string(),value:z.object({metadata:z.object({phone_number_id:z.string()}),statuses:z.unknown().optional()})}))}))}).safeParse(payload);
 if(!parsed.success)return;
 for(const entry of parsed.data.entry)for(const change of entry.changes){
  if(change.field!=='messages'||change.value.metadata.phone_number_id!==accountId||!change.value.statuses)continue;
  const updates=statuses.safeParse(change.value.statuses);if(!updates.success)continue;
  for(const status of updates.data)await withData(async db=>{
   const rank={sent:1,delivered:2,read:3,failed:2}[status.status];
   await db.update(quotationDeliveries).set({deliveryStatus:status.status}).where(all(eq(quotationDeliveries.channel,'whatsapp'),eq(quotationDeliveries.providerAccountId,accountId),eq(quotationDeliveries.providerMessageId,status.id),eq(quotationDeliveries.state,'accepted'),
    sql`case ${quotationDeliveries.deliveryStatus} when 'read' then 3 when 'delivered' then 2 when 'sent' then 1 when 'failed' then 1 else 0 end < ${rank}`));
  });
 }
}
