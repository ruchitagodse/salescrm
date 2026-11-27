import { sql } from 'drizzle-orm';
import { pgTable,customType,text,uuid,integer,jsonb,uniqueIndex,check,index } from 'drizzle-orm/pg-core';
import { id,createdAt,updatedAt,deletedAt } from './columns';
import { quotations } from './commerce';
const bytea=customType<{data:Buffer;driverData:Buffer}>({dataType:()=> 'bytea'});
const stamps=()=>({createdAt:createdAt(),updatedAt:updatedAt(),deletedAt:deletedAt()});
export const quotationDocuments=pgTable('quotation_documents',{
 id:id(),quotationId:uuid('quotation_id').notNull().references(()=>quotations.id,{onDelete:'restrict'}),
 version:integer('version').notNull(),fingerprint:text('fingerprint').notNull(),sha256:text('sha256').notNull(),
 snapshot:jsonb('snapshot').notNull(),pdf:bytea('pdf').notNull(),...stamps(),
},t=>[uniqueIndex('quotation_documents_version_unique').on(t.quotationId,t.version),uniqueIndex('quotation_documents_content_unique').on(t.quotationId,t.fingerprint),check('quotation_documents_size_check',sql`octet_length(${t.pdf}) between 1 and 5242880`)]).enableRLS();
export const quotationDeliveries=pgTable('quotation_deliveries',{
 id:id(),quotationId:uuid('quotation_id').notNull().references(()=>quotations.id,{onDelete:'restrict'}),
 documentId:uuid('document_id').notNull().references(()=>quotationDocuments.id,{onDelete:'restrict'}),
 channel:text('channel').notNull(),recipient:text('recipient').notNull(),
 state:text('state').notNull().default('pending'),providerAccountId:text('provider_account_id'),providerMessageId:text('provider_message_id'),
 providerResponse:text('provider_response'),deliveryStatus:text('delivery_status'),...stamps(),
},t=>[check('quotation_deliveries_channel_check',sql`${t.channel} in ('email','whatsapp')`),check('quotation_deliveries_state_check',sql`${t.state} in ('pending','accepted','failed','unknown')`),index('quotation_deliveries_quote_idx').on(t.quotationId),index('quotation_deliveries_provider_idx').on(t.providerMessageId)]).enableRLS();
export const quotationHistory=pgTable('quotation_history',{
 id:id(),quotationId:uuid('quotation_id').notNull().references(()=>quotations.id,{onDelete:'restrict'}),
 event:text('event').notNull(),detail:text('detail'),...stamps(),
}).enableRLS();
