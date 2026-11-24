import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt, deletedAt } from "./columns";
import { companies } from "./companies";

export const contacts = pgTable("contacts", {
  id: id(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "restrict" }),
  fullName: text("full_name").notNull(),
  email: text("email"), phone: text("phone"), instagramHandle: text("instagram_handle"),
  city: text("city"), notes: text("notes"),
  phoneNormalized: text("phone_normalized"), emailNormalized: text("email_normalized"),
  createdAt: createdAt(), updatedAt: updatedAt(), deletedAt: deletedAt(),
}, (t) => [
  check("contacts_reachable_check", sql`nullif(btrim(${t.phone}), '') is not null or nullif(btrim(${t.email}), '') is not null or nullif(btrim(${t.instagramHandle}), '') is not null`),
  uniqueIndex("contacts_live_phone_unique").on(t.phoneNormalized)
    .where(sql`${t.deletedAt} is null and ${t.phoneNormalized} is not null`),
  uniqueIndex("contacts_live_email_unique").on(t.emailNormalized)
    .where(sql`${t.deletedAt} is null and ${t.emailNormalized} is not null`),
  index("contacts_company_id_idx").on(t.companyId),
]).enableRLS();
