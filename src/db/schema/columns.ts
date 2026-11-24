import { bigint, timestamp, uuid } from "drizzle-orm/pg-core";

export const id = () => uuid("id").defaultRandom().primaryKey();
export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
export const deletedAt = () => timestamp("deleted_at", { withTimezone: true });

// INR paise, exact bigint arithmetic. JSON must serialize decimal strings.
// Do not coerce to number: JS safe integer limit is 9,007,199,254,740,991.
export const paise = (name: string) => bigint(name, { mode: "bigint" });
