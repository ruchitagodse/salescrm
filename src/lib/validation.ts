import { z } from "zod";
import { LEAD_ENTRY_METHODS, LEAD_SOURCES, LEAD_STATUSES } from "./lead-values.ts";
import { normalizeEmail, normalizePhone } from "./normalize.ts";

const optionalText = z.string().trim().transform((s) => s || null).nullable().optional();
const requiredText = z.string().trim().min(1);
const nonEmptyUpdate = (v: object) => Object.values(v).some((value) => value !== undefined);
export const entityIdSchema = z.uuid();
const phone = optionalText.refine((s) => {
  try { normalizePhone(s); return true; } catch { return false; }
}, "Invalid phone number");
const email = optionalText.transform((s) => s === undefined ? undefined : normalizeEmail(s))
  .refine((s) => !s || z.email().safeParse(s).success, "Invalid email");
export const budgetPaiseSchema = z.union([z.bigint(), z.string().max(20).regex(/^-?\d+$/).transform(BigInt)])
  .refine((n) => n >= BigInt("-9223372036854775808") && n <= BigInt("9223372036854775807"), "Budget out of range")
  .nullable().optional();
const deadline = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, "Invalid calendar date").nullable().optional();

const companyFields = z.object({
  name: requiredText, website: optionalText, industry: optionalText, city: optionalText, notes: optionalText,
}).strict();
export const createCompanySchema = companyFields;
export const updateCompanySchema = companyFields.partial().refine(nonEmptyUpdate, "Empty update");

const contactFields = z.object({
  companyId: entityIdSchema.nullable().optional(), fullName: requiredText,
  email, phone, instagramHandle: optionalText, city: optionalText, notes: optionalText,
}).strict();
export const createContactSchema = contactFields.refine(
  (v) => Boolean(v.phone || v.email || v.instagramHandle), "A contact method is required",
);
// A partial update must be validated again against the locked, complete row.
export const updateContactSchema = contactFields.partial().refine(nonEmptyUpdate, "Empty update");

const leadFields = z.object({
  source: z.enum(LEAD_SOURCES), status: z.enum(LEAD_STATUSES),
  entryMethod: z.enum(LEAD_ENTRY_METHODS), sourceDetail: optionalText,
  serviceNeeds: optionalText, requirement: optionalText, deadline, budgetPaise: budgetPaiseSchema,
  lostReason: optionalText, notes: optionalText,
}).strict();
const requireLostReason = (v: { status: string; lostReason?: string | null }) => v.status !== "lost" || Boolean(v.lostReason);
export const leadDetailsSchema = leadFields.extend({
  status: z.enum(LEAD_STATUSES).default("new"),
  entryMethod: z.enum(LEAD_ENTRY_METHODS).default("manual"),
})
  .refine(requireLostReason, "Lost reason is required");
export const createLeadSchema = leadFields.extend({
  contactId: entityIdSchema, status: z.enum(LEAD_STATUSES).default("new"),
  entryMethod: z.enum(LEAD_ENTRY_METHODS).default("manual"),
}).refine(requireLostReason, "Lost reason is required");
export const updateLeadSchema = leadFields.extend({ contactId: entityIdSchema }).partial()
  .refine(nonEmptyUpdate, "Empty update");
export const createLeadWithContactSchema = z.object({ contact: createContactSchema, lead: leadDetailsSchema }).strict();

const pagination = {
  page: z.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(500).optional(),
};
export const companyListSchema = z.object(pagination).strict();
export const contactListSchema = z.object({ ...pagination, companyId: entityIdSchema.optional() }).strict();
export const leadListSchema = z.object({
  ...pagination, contactId: entityIdSchema.optional(), source: z.enum(LEAD_SOURCES).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
}).strict();
export type ContactInput = z.output<typeof createContactSchema>;
