import 'server-only';
import {eq,isNull,sql,gte} from 'drizzle-orm';
import {quotationDocuments as documents,quotationDeliveries as deliveries,quotations,integrationEvents} from '@/db/schema';
import {quotationSnapshot} from './quotation-documents';
import {all,withData,validate,found,DataError} from './shared';
import {entityIdSchema} from '@/lib/validation';
import {z} from 'zod';
import {normalizePhone} from '@/lib/normalize';
import {submitEmail,submitWhatsApp,deliveryConfiguration,DeliveryError} from '@/lib/quotation-delivery';
import {indiaLocalInput} from '@/lib/activity-time';
export async function sendQuotationDocument(input:{id:string;documentId:string;channel:'email'|'whatsapp';recipient:string}){
 validate(entityIdSchema,input.id);validate(entityIdSchema,input.documentId);
 const channel=z.enum(['email','whatsapp']).parse(input.channel);
 const recipient=channel==='email'?z.email().parse(input.recipient.trim()).toLowerCase():normalizePhone(input.recipient)?.replace('+','');
 if(!recipient)throw new DataError('INVALID_INPUT');
 if(!deliveryConfiguration()[channel])return {state:'failed',message:channel==='email'?'Email is not configured. Configure SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASSWORD privately.':'WhatsApp is not configured. Configure the Business API access token, phone ID and Graph version. PDF download remains available.'};
 const reserved=await withData(db=>db.transaction(async tx=>{
  const [doc]=await tx.select().from(documents).where(all(eq(documents.id,input.documentId),isNull(documents.deletedAt)));const document=found(doc);
  const current=await quotationSnapshot(tx,document.quotationId);
  if(!['draft','sent'].includes(current.quote.status)||current.fingerprint!==document.fingerprint)throw new DataError('INVALID_STATE');
  if(current.quote.validUntil&&current.quote.validUntil<indiaLocalInput(new Date()).slice(0,10))throw new DataError('INVALID_STATE');
  const [existing]=await tx.select().from(deliveries).where(eq(deliveries.id,input.id));if(existing){if(existing.documentId!==input.documentId||existing.channel!==channel||existing.recipient!==recipient)throw new DataError('CONFLICT');return {document,existing};}
  const [ambiguous]=await tx.select({id:deliveries.id}).from(deliveries).where(all(eq(deliveries.quotationId,document.quotationId),eq(deliveries.channel,channel),eq(deliveries.recipient,recipient),sql`${deliveries.state} in ('pending','unknown')`));if(ambiguous)throw new DataError('INVALID_STATE');
  await tx.insert(deliveries).values({id:input.id,quotationId:document.quotationId,documentId:document.id,channel,recipient});return {document,existing:null};
 }));
 if(reserved.existing)return {state:reserved.existing.state,message:`Submission ${reserved.existing.state}. No duplicate message was sent.`};
 try{
  let inSession=false;
  if(channel==='whatsapp')inSession=await withData(async db=>{
   const [row]=await db.select({id:integrationEvents.id}).from(integrationEvents).where(all(eq(integrationEvents.channel,'whatsapp'),eq(integrationEvents.accountId,process.env.WHATSAPP_PHONE_NUMBER_ID!),eq(integrationEvents.senderId,recipient),isNull(integrationEvents.deletedAt),gte(integrationEvents.occurredAt,new Date(Date.now()-24*60*60*1000)))).limit(1);return Boolean(row);
  });
  const snapshot=reserved.document.snapshot as {reference:string};
  const confirmation=channel==='email'?await submitEmail({id:input.id,recipient,reference:snapshot.reference,pdf:reserved.document.pdf}):await submitWhatsApp({recipient,reference:snapshot.reference,pdf:reserved.document.pdf,inSession});
  await withData(db=>db.transaction(async tx=>{
   await tx.select({id:quotations.id}).from(quotations).where(eq(quotations.id,reserved.document.quotationId)).for('update');
   await tx.update(deliveries).set({state:'accepted',providerMessageId:confirmation.messageId,providerResponse:confirmation.response,providerAccountId:confirmation.accountId}).where(eq(deliveries.id,input.id));
   await tx.update(quotations).set({status:'sent'}).where(all(eq(quotations.id,reserved.document.quotationId),eq(quotations.status,'draft')));
  }));return {state:'accepted',message:'Provider accepted the submission. Delivery is not yet confirmed.'};
 }catch(error){
  const state=error instanceof DeliveryError&&!error.ambiguous?'failed':'unknown';
  await withData(db=>db.update(deliveries).set({state,providerResponse:error instanceof DeliveryError?error.code:'PROVIDER_RESULT_UNKNOWN'}).where(all(eq(deliveries.id,input.id),eq(deliveries.state,'pending'))));
  if(error instanceof DeliveryError&&error.code==='WHATSAPP_TEMPLATE_REQUIRED')return {state,message:'WhatsApp requires a verified inbound message in the last 24 hours or a configured approved document template. PDF download remains available.'};
  return {state,message:state==='unknown'?'Submission outcome is unknown. Check provider records before sending again; no automatic retry was made.':'Provider submission did not succeed. Check the configuration/status code before starting a new attempt.'};
 }
}
