import { z } from "zod";
import { MAX_PAISE, QUOTATION_STATUSES } from "./finance-values.ts";
export const quotationStatusSchema = z.enum(QUOTATION_STATUSES);
const text = z.string().trim().transform((s) => s || null).nullable().optional();
const money = z.union([z.bigint(), z.string().max(19).regex(/^\d+$/).transform(BigInt)])
  .refine((v) => v >= BigInt(0) && v <= MAX_PAISE, "Amount out of range");
export const positiveMoney = money.refine((v) => v > BigInt(0), "Amount must be positive");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
  const date = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v;
}, "Invalid date");
export const quotationInputSchema = z.object({
  title: z.string().trim().min(1).max(300), dealId: z.uuid().nullable().optional(), leadId:z.uuid().nullable().optional(), notes: text,
  description:text, validUntil:day.nullable().optional(), paymentTerms:text,
  discountPaise:money.default(BigInt(0)),taxPaise:money.default(BigInt(0)),
  milestones:z.array(z.object({label:z.string().trim().min(1).max(100),amountPaise:positiveMoney.transform(String)}).strict()).max(20).default([]),
  items: z.array(z.object({
    description: z.string().trim().min(1).max(4000),
    quantity: z.union([z.number().int(), z.string().max(7).regex(/^\d+$/).transform(Number)]).refine((v) => v >= 1 && v <= 1_000_000, "Quantity must be a positive whole number"),
    unitPricePaise: money,
  }).strict()).min(1).max(100),
}).strict().refine(v=>Boolean(v.dealId)!==Boolean(v.leadId),'Select either a lead or a deal');
export const paymentInputSchema = z.object({ orderId: z.uuid(), amountPaise: positiveMoney, paidOn: day, method: text, reference: text, notes: text }).strict();
export const expenseInputSchema = z.object({ spentOn: day, payee: z.string().trim().min(1), category: z.string().trim().min(1), amountPaise: positiveMoney, notes: text }).strict();
export const voidInputSchema = z.object({ reason: z.string().trim().min(1).max(2000) }).strict();
export const financeListSchema = z.object({ search: z.string().trim().max(500).optional(), page: z.number().int().min(1).max(1_000_000).default(1), pageSize: z.number().int().min(1).max(100).default(25) }).strict();
