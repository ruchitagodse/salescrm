import { z } from "zod";
import { ACTIVITY_STATUSES, ACTIVITY_TARGETS, ACTIVITY_TYPES, ACTIVITY_VIEWS } from "./activity-values.ts";

const fields = z.object({
  title: z.string().trim().min(1), type: z.enum(ACTIVITY_TYPES), status: z.enum(ACTIVITY_STATUSES),
  dueAt: z.union([z.date(), z.iso.datetime({ offset: true }).transform((value) => new Date(value))]),
  targetType: z.enum(ACTIVITY_TARGETS), targetId: z.uuid(),
  notes: z.string().trim().transform((value) => value || null).nullable().optional(),
}).strict();
export const completeActivitySchema = fields;
export const createActivitySchema = fields.extend({ status: z.enum(ACTIVITY_STATUSES).default("planned") });
export const updateActivitySchema = fields.partial()
  .refine((v) => Object.values(v).some((value) => value !== undefined), "Empty update")
  .refine((v) => (v.targetType === undefined) === (v.targetId === undefined), "Change target type and ID together");
export const activityListSchema = z.object({
  view: z.enum(ACTIVITY_VIEWS).default("all"), type: z.enum(ACTIVITY_TYPES).optional(),
  search: z.string().trim().max(500).optional(),
  targetType: z.enum(ACTIVITY_TARGETS).optional(), targetId: z.uuid().optional(),
  page: z.number().int().min(1).max(1_000_000).default(1), pageSize: z.number().int().min(1).max(100).default(25),
}).strict().refine((v) => Boolean(v.targetType) === Boolean(v.targetId), "Provide target type and ID together");
