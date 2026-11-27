import 'server-only';
import { createHash } from 'node:crypto';
import { eq,asc,desc,isNull } from 'drizzle-orm';
import { quotations,quotationItems,quotationDocuments as documents,quotationDeliveries as deliveries,quotationHistory as history,leads,deals,contacts,companies } from '@/db/schema';
import { all,found,validate,withData,DataError,type Transaction } from './shared';
import { entityIdSchema } from '@/lib/validation';
import { documentReference,quotationTotals } from '@/lib/finance-values';
import { indiaLocalInput } from '@/lib/activity-time';
import { renderQuotationPdf,type QuotationSnapshot } from '@/lib/quotation-pdf';
async function snapshot(tx:Transaction,id:string){
 const [q]=await tx.select().from(quotations).where(all(eq(quotations.id,id),isNull(quotations.deletedAt))).for('update');const quote=found(q);
 const items=await tx.select().from(quotationItems).where(all(eq(quotationItems.quotationId,id),isNull(quotationItems.deletedAt))).orderBy(asc(quotationItems.position));
 const [client]=await tx.select({name:contacts.fullName,email:contacts.email,phone:contacts.phone,city:contacts.city,company:companies.name}).from(leads)
  .innerJoin(contacts,eq(leads.contactId,contacts.id)).leftJoin(deals,eq(deals.leadId,leads.id)).leftJoin(companies,all(eq(companies.id,contacts.companyId),isNull(companies.deletedAt)))
  .where(all(quote.dealId?eq(deals.id,quote.dealId):eq(leads.id,quote.leadId!),isNull(contacts.deletedAt)));
 const subtotal=items.reduce((sum,i)=>sum+i.lineTotalPaise,BigInt(0));
 if(!items.length||quotationTotals(subtotal,quote.discountPaise,quote.taxPaise,quote.milestones)!==quote.totalPaise)throw new DataError('INVALID_STATE');
 const value:QuotationSnapshot={reference:documentReference('Q',quote.number),issuedOn:indiaLocalInput(quote.createdAt).slice(0,10),title:quote.title,
  description:quote.description,validUntil:quote.validUntil,paymentTerms:quote.paymentTerms,notes:quote.notes,client:found(client),
  brand:{name:'PROSPERA Digital Solutions',website:'https://prosperadigitalstudio.vercel.app/',signOff:'Ruchita Godse',address:process.env.QUOTATION_BUSINESS_ADDRESS||null,email:process.env.QUOTATION_PUBLIC_EMAIL||null,phone:process.env.QUOTATION_PUBLIC_PHONE||null},
  items:items.map(i=>({description:i.description,quantity:i.quantity,unitPricePaise:String(i.unitPricePaise),lineTotalPaise:String(i.lineTotalPaise)})),
  subtotalPaise:String(subtotal),discountPaise:String(quote.discountPaise),taxPaise:String(quote.taxPaise),totalPaise:String(quote.totalPaise),milestones:quote.milestones};
 return {quote,value,fingerprint:createHash('sha256').update(JSON.stringify(value)).digest('hex')};
}
export async function generateQuotationDocument(id:string){validate(entityIdSchema,id);return withData(db=>db.transaction(async tx=>{
 const current=await snapshot(tx,id);
 const [existing]=await tx.select({id:documents.id}).from(documents).where(all(eq(documents.quotationId,id),eq(documents.fingerprint,current.fingerprint)));if(existing)return existing;
 const [last]=await tx.select({version:documents.version}).from(documents).where(eq(documents.quotationId,id)).orderBy(desc(documents.version)).limit(1);
 const pdf=await renderQuotationPdf(current.value);if(pdf.length>5242880)throw new DataError('INVALID_INPUT');
 const [row]=await tx.insert(documents).values({quotationId:id,version:(last?.version??0)+1,fingerprint:current.fingerprint,sha256:createHash('sha256').update(pdf).digest('hex'),snapshot:current.value,pdf}).returning({id:documents.id});
 await tx.insert(history).values({quotationId:id,event:'pdf_generated',detail:`Version ${(last?.version??0)+1}`});return found(row);
}));}
export async function quotationDocumentHistory(id:string){validate(entityIdSchema,id);return withData(async db=>{
 const [versions,sends,events]=await Promise.all([
  db.select({id:documents.id,version:documents.version,sha256:documents.sha256,createdAt:documents.createdAt,snapshot:documents.snapshot}).from(documents).where(all(eq(documents.quotationId,id),isNull(documents.deletedAt))).orderBy(desc(documents.version)),
  db.select().from(deliveries).where(all(eq(deliveries.quotationId,id),isNull(deliveries.deletedAt))).orderBy(desc(deliveries.createdAt)),
  db.select().from(history).where(all(eq(history.quotationId,id),isNull(history.deletedAt))).orderBy(desc(history.createdAt))]);return {versions,sends,events};
});}
export async function getQuotationDocument(id:string){validate(entityIdSchema,id);return withData(async db=>{
 const [row]=await db.select().from(documents).innerJoin(quotations,eq(quotations.id,documents.quotationId)).where(all(eq(documents.id,id),isNull(documents.deletedAt),isNull(quotations.deletedAt)));return found(row).quotation_documents;
});}
export {snapshot as quotationSnapshot};
