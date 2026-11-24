import { pgTable, text } from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt, deletedAt } from "./columns";

export const companies = pgTable("companies", {
  id: id(),
  name: text("name").notNull(),
  website: text("website"),
  industry: text("industry"),
  city: text("city"),
  notes: text("notes"),
  createdAt: createdAt(), updatedAt: updatedAt(), deletedAt: deletedAt(),
}).enableRLS();
