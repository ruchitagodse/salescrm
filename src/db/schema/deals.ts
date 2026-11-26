import { sql } from "drizzle-orm";
import { check, date, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { DEAL_OUTCOMES } from "../../lib/deal-values";
import { id, createdAt, updatedAt, deletedAt, paise } from "./columns";
import { leads } from "./leads";
import { pipelineStages } from "./pipeline-stages";

export const deals = pgTable("deals", {
  id: id(), title: text("title").notNull(),
  // Unconditional uniqueness deliberately includes archived deals.
  leadId: uuid("lead_id").notNull().unique().references(() => leads.id, { onDelete: "restrict" }),
  stageId: uuid("stage_id").notNull().references(() => pipelineStages.id, { onDelete: "restrict" }),
  valuePaise: paise("value_paise"), expectedCloseDate: date("expected_close_date", { mode: "string" }),
  outcome: text("outcome", { enum: DEAL_OUTCOMES }).notNull().default("open"),
  lossReason: text("loss_reason"), notes: text("notes"),
  createdAt: createdAt(), updatedAt: updatedAt(), deletedAt: deletedAt(),
}, (t) => [
  check("deals_title_check", sql`nullif(btrim(${t.title}), '') is not null`),
  check("deals_outcome_check", sql`${t.outcome} in (${sql.join(DEAL_OUTCOMES.map((value) => sql.raw(`'${value}'`)), sql`, `)})`),
  check("deals_value_check", sql`${t.valuePaise} is null or ${t.valuePaise} >= 0`),
  check("deals_loss_reason_check", sql`${t.outcome} <> 'lost' or nullif(btrim(${t.lossReason}), '') is not null`),
  index("deals_stage_id_idx").on(t.stageId), index("deals_outcome_idx").on(t.outcome),
  index("deals_created_at_idx").on(t.createdAt),
]).enableRLS();
