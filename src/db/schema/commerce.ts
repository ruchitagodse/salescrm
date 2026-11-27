import { sql } from "drizzle-orm";
import { bigint, check, date, index, integer, jsonb, pgSequence, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { FINANCIAL_STATUSES, QUOTATION_STATUSES } from "../../lib/finance-values";
import { id, createdAt, updatedAt, deletedAt, paise } from "./columns";
import { deals } from "./deals";
import { leads } from "./leads";
const stamps = () => ({ createdAt: createdAt(), updatedAt: updatedAt(), deletedAt: deletedAt() });
const values = (set: readonly string[]) => sql.join(set.map((v) => sql.raw(`'${v}'`)), sql`, `);
export const quotationNumberSequence = pgSequence("quotation_number_seq");
export const orderNumberSequence = pgSequence("order_number_seq");
export const quotations = pgTable("quotations", {
  id: id(), number: bigint("number", { mode: "bigint" }).notNull().unique().default(sql`nextval('public.quotation_number_seq')`),
  title: text("title").notNull(), dealId: uuid("deal_id").references(() => deals.id, { onDelete: "restrict" }),
  leadId:uuid('lead_id').references(()=>leads.id,{onDelete:'restrict'}),
  description:text('description'),validUntil:date('valid_until',{mode:'string'}),paymentTerms:text('payment_terms'),
  discountPaise:paise('discount_paise').notNull().default(sql`0`),taxPaise:paise('tax_paise').notNull().default(sql`0`),
  milestones:jsonb('milestones').$type<{label:string;amountPaise:string}[]>().notNull().default(sql`'[]'::jsonb`),
  status: text("status", { enum: QUOTATION_STATUSES }).notNull().default("draft"), totalPaise: paise("total_paise").notNull(), notes: text("notes"), ...stamps(),
}, (t) => [check("quotations_number_check", sql`${t.number} > 0`), check("quotations_status_check", sql`${t.status} in (${values(QUOTATION_STATUSES)})`), check("quotations_total_check", sql`${t.totalPaise} >= 0`), check("quotations_title_check", sql`nullif(btrim(${t.title}),'') is not null`), index("quotations_deal_idx").on(t.dealId)]).enableRLS();
export const quotationItems = pgTable("quotation_items", {
  id: id(), quotationId: uuid("quotation_id").notNull().references(() => quotations.id, { onDelete: "restrict" }),
  description: text("description").notNull(), quantity: integer("quantity").notNull(), unitPricePaise: paise("unit_price_paise").notNull(),
  lineTotalPaise: paise("line_total_paise").notNull(), position: integer("position").notNull(), ...stamps(),
}, (t) => [check("quotation_items_values_check", sql`${t.quantity} > 0 and ${t.unitPricePaise} >= 0 and ${t.lineTotalPaise} = ${t.unitPricePaise}::numeric * ${t.quantity} and nullif(btrim(${t.description}),'') is not null`), uniqueIndex("quotation_items_live_position_unique").on(t.quotationId, t.position).where(sql`${t.deletedAt} is null`)]).enableRLS();
export const orders = pgTable("orders", {
  id: id(), number: bigint("number", { mode: "bigint" }).notNull().unique().default(sql`nextval('public.order_number_seq')`),
  quotationId: uuid("quotation_id").notNull().unique().references(() => quotations.id, { onDelete: "restrict" }),
  discountPaise:paise('discount_paise').notNull().default(sql`0`),taxPaise:paise('tax_paise').notNull().default(sql`0`),
  title: text("title").notNull(), customerName: text("customer_name").notNull(), totalPaise: paise("total_paise").notNull(), notes: text("notes"), ...stamps(),
}, (t) => [check("orders_number_check", sql`${t.number} > 0`), check("orders_text_check", sql`nullif(btrim(${t.title}),'') is not null and nullif(btrim(${t.customerName}),'') is not null`), check("orders_total_check", sql`${t.totalPaise} >= 0`)]).enableRLS();
export const orderItems = pgTable("order_items", {
  id: id(), orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  description: text("description").notNull(), quantity: integer("quantity").notNull(), unitPricePaise: paise("unit_price_paise").notNull(),
  lineTotalPaise: paise("line_total_paise").notNull(), position: integer("position").notNull(), ...stamps(),
}, (t) => [check("order_items_values_check", sql`${t.quantity} > 0 and ${t.unitPricePaise} >= 0 and ${t.lineTotalPaise} = ${t.unitPricePaise}::numeric * ${t.quantity} and nullif(btrim(${t.description}),'') is not null`), uniqueIndex("order_items_position_unique").on(t.orderId, t.position)]).enableRLS();
const financialFields = () => ({ status: text("status", { enum: FINANCIAL_STATUSES }).notNull().default("recorded"), voidReason: text("void_reason"), voidedAt: timestamp("voided_at", { withTimezone: true }) });
export const payments = pgTable("payments", {
  id: id(), orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  amountPaise: paise("amount_paise").notNull(), paidOn: date("paid_on", { mode: "string" }).notNull(), method: text("method"), reference: text("reference"), notes: text("notes"), ...financialFields(), ...stamps(),
}, (t) => [check("payments_amount_check", sql`${t.amountPaise} > 0`), check("payments_status_check", sql`${t.status} in (${values(FINANCIAL_STATUSES)})`), check("payments_void_check", sql`(${t.status}='recorded' and ${t.voidReason} is null and ${t.voidedAt} is null) or (${t.status}='voided' and nullif(btrim(${t.voidReason}),'') is not null and ${t.voidedAt} is not null)`), index("payments_order_idx").on(t.orderId)]).enableRLS();
export const expenses = pgTable("expenses", {
  id: id(), spentOn: date("spent_on", { mode: "string" }).notNull(), payee: text("payee").notNull(), category: text("category").notNull(), amountPaise: paise("amount_paise").notNull(), notes: text("notes"), ...financialFields(), ...stamps(),
}, (t) => [check("expenses_amount_check", sql`${t.amountPaise} > 0`), check("expenses_text_check", sql`nullif(btrim(${t.payee}),'') is not null and nullif(btrim(${t.category}),'') is not null`), check("expenses_status_check", sql`${t.status} in (${values(FINANCIAL_STATUSES)})`), check("expenses_void_check", sql`(${t.status}='recorded' and ${t.voidReason} is null and ${t.voidedAt} is null) or (${t.status}='voided' and nullif(btrim(${t.voidReason}),'') is not null and ${t.voidedAt} is not null)`), index("expenses_spent_on_idx").on(t.spentOn)]).enableRLS();
