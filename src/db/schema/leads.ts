import { sql } from "drizzle-orm";
import { check, date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { LEAD_ENTRY_METHODS, LEAD_SOURCES, LEAD_STATUSES } from "../../lib/lead-values";
import { id, createdAt, updatedAt, deletedAt, paise } from "./columns";
import { contacts } from "./contacts";

// Only fixed application constants enter these literals; input never uses sql.raw.
const literals = (values: readonly string[]) =>
  sql.join(values.map((value) => sql.raw(`'${value.replaceAll("'", "''")}'`)), sql`, `);

export const leads = pgTable("leads", {
  id: id(),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "restrict" }),
  source: text("source", { enum: LEAD_SOURCES }).notNull(),
  status: text("status", { enum: LEAD_STATUSES }).notNull().default("new"),
  entryMethod: text("entry_method", { enum: LEAD_ENTRY_METHODS }).notNull().default("manual"),
  sourceDetail: text("source_detail"),
  serviceNeeds: text("service_needs"), requirement: text("requirement"),
  deadline: date("deadline", { mode: "string" }), budgetPaise: paise("budget_paise"),
  lostReason: text("lost_reason"), convertedAt: timestamp("converted_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: createdAt(), updatedAt: updatedAt(), deletedAt: deletedAt(),
}, (t) => [
  check("leads_source_check", sql`${t.source} in (${literals(LEAD_SOURCES)})`),
  check("leads_status_check", sql`${t.status} in (${literals(LEAD_STATUSES)})`),
  check("leads_entry_method_check", sql`${t.entryMethod} in (${literals(LEAD_ENTRY_METHODS)})`),
  check("leads_lost_reason_check", sql`${t.status} <> 'lost' or nullif(btrim(${t.lostReason}), '') is not null`),
  index("leads_status_idx").on(t.status),
  index("leads_contact_id_idx").on(t.contactId),
  index("leads_created_at_idx").on(t.createdAt),
]).enableRLS();
