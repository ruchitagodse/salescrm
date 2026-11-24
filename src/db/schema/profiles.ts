import { pgSchema, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./columns";

// Reference only: do not export this table/schema from the migration entrypoint.
// Supabase owns auth.users; Drizzle must never manage it.
const authUsers = pgSchema("auth").table("users", {
  id: uuid("id").primaryKey(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().references(() => authUsers.id, { onDelete: "cascade" }),
  fullName: text("full_name"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}).enableRLS();
