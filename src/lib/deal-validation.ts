import { z } from "zod";
import { DEAL_OUTCOMES, PIPELINE_STAGE_KEYS } from "./deal-values.ts";
import { budgetPaiseSchema } from "./validation.ts";

const text = z.string().trim().transform((v) => v || null).nullable().optional();
const closeDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
  const date = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v;
}, "Invalid calendar date").nullable().optional();
const fields = z.object({
  title: z.string().trim().min(1), stageKey: z.enum(PIPELINE_STAGE_KEYS),
  valuePaise: budgetPaiseSchema.refine((value) => value == null || value >= BigInt(0), "Value cannot be negative"),
  expectedCloseDate: closeDate, outcome: z.enum(DEAL_OUTCOMES), lossReason: text, notes: text,
}).strict();
export const completeDealSchema = fields.refine((value) => value.outcome !== "lost" || Boolean(value.lossReason), {
  message: "A loss reason is required.", path: ["lossReason"],
});
export const convertDealSchema = fields.omit({ outcome: true, lossReason: true }).extend({
  stageKey: z.enum(PIPELINE_STAGE_KEYS).default("discovery"),
});
export const updateDealSchema = fields.partial().refine((value) => Object.values(value).some((v) => v !== undefined), "Empty update");
export const dealListSchema = z.object({
  search: z.string().trim().max(500).optional(),
  stageKey: z.enum(PIPELINE_STAGE_KEYS).optional(), outcome: z.enum(DEAL_OUTCOMES).optional(),
  page: z.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
}).strict();
