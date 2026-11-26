import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { ACTIVITY_STATUSES, ACTIVITY_TYPES } from "../../lib/activity-values";
import { id, createdAt, updatedAt, deletedAt } from "./columns";
import { contacts } from "./contacts";
import { leads } from "./leads";
import { deals } from "./deals";

export const activities = pgTable("activities", {
  id: id(), title: text("title").notNull(),
  type: text("type", { enum: ACTIVITY_TYPES }).notNull(),
  status: text("status", { enum: ACTIVITY_STATUSES }).notNull().default("planned"),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }), notes: text("notes"),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "restrict" }),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "restrict" }),
  dealId: uuid("deal_id").references(() => deals.id, { onDelete: "restrict" }),
  createdAt: createdAt(), updatedAt: updatedAt(), deletedAt: deletedAt(),
}, (t) => [
  check("activities_title_check", sql`nullif(btrim(${t.title}), '') is not null`),
  check("activities_type_check", sql`${t.type} in (${sql.join(ACTIVITY_TYPES.map((v) => sql.raw(`'${v}'`)), sql`, `)})`),
  check("activities_status_check", sql`${t.status} in (${sql.join(ACTIVITY_STATUSES.map((v) => sql.raw(`'${v}'`)), sql`, `)})`),
  check("activities_one_target_check", sql`num_nonnulls(${t.contactId}, ${t.leadId}, ${t.dealId}) = 1`),
  check("activities_completion_check", sql`(${t.status} = 'completed' and ${t.completedAt} is not null) or (${t.status} <> 'completed' and ${t.completedAt} is null)`),
  index("activities_due_at_idx").on(t.dueAt), index("activities_status_due_idx").on(t.status, t.dueAt),
  index("activities_contact_id_idx").on(t.contactId), index("activities_lead_id_idx").on(t.leadId), index("activities_deal_id_idx").on(t.dealId),
]).enableRLS();
