import { sql } from "drizzle-orm";
import { check, integer, pgTable, text } from "drizzle-orm/pg-core";
import { PIPELINE_STAGE_KEYS } from "../../lib/deal-values";
import { id, createdAt, updatedAt, deletedAt } from "./columns";

export const pipelineStages = pgTable("pipeline_stages", {
  id: id(), key: text("key", { enum: PIPELINE_STAGE_KEYS }).notNull().unique(),
  name: text("name").notNull(), position: integer("position").notNull().unique(),
  createdAt: createdAt(), updatedAt: updatedAt(), deletedAt: deletedAt(),
}, (t) => [
  check("pipeline_stages_key_check", sql`${t.key} in (${sql.join(PIPELINE_STAGE_KEYS.map((key) => sql.raw(`'${key}'`)), sql`, `)})`),
  check("pipeline_stages_position_check", sql`${t.position} >= 0`),
]).enableRLS();
