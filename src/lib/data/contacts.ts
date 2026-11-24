import "server-only";

import { randomUUID } from "node:crypto";
import { count, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { contacts } from "@/db/schema";
import { contactListSchema, createContactSchema, entityIdSchema, updateContactSchema } from "@/lib/validation";
import { all, found, lockContactKeys, normalizedFields, omitUndefined, requireLiveCompany, searchPattern, validate, withData } from "./shared";

export async function createContact(input: unknown) {
  return withData(async (db) => {
    const values = validate(createContactSchema, input);
    const normalized = normalizedFields(values);
    return db.transaction(async (tx) => {
      await lockContactKeys(tx, normalized.phoneNormalized, normalized.emailNormalized);
      await requireLiveCompany(tx, values.companyId);
      const [row] = await tx.insert(contacts).values({ id: randomUUID(), ...values, ...normalized }).returning();
      return found(row);
    });
  });
}

export async function updateContact(contactId: string, input: unknown) {
  return withData(async (db) => {
    const id = validate(entityIdSchema, contactId);
    const patch = omitUndefined(validate(updateContactSchema, input));
    const incomingKeys = normalizedFields(patch);
    return db.transaction(async (tx) => {
      await lockContactKeys(tx, incomingKeys.phoneNormalized, incomingKeys.emailNormalized);
      const [row] = await tx.select().from(contacts).where(all(eq(contacts.id, id), isNull(contacts.deletedAt))).for("update");
      const current = found(row);
      const values = validate(createContactSchema, {
        companyId: current.companyId, fullName: current.fullName, email: current.email,
        phone: current.phone, instagramHandle: current.instagramHandle, city: current.city,
        notes: current.notes, ...patch,
      });
      if (patch.companyId !== undefined) await requireLiveCompany(tx, values.companyId);
      const [updated] = await tx.update(contacts).set({ ...values, ...normalizedFields(values) })
        .where(all(eq(contacts.id, id), isNull(contacts.deletedAt))).returning();
      return found(updated);
    });
  });
}

export async function softDeleteContact(contactId: string) {
  return withData(async (db) => {
    const id = validate(entityIdSchema, contactId);
    const [row] = await db.update(contacts).set({ deletedAt: new Date() })
      .where(all(eq(contacts.id, id), isNull(contacts.deletedAt))).returning({ id: contacts.id });
    return found(row);
  });
}

export async function getContact(contactId: string) {
  return withData(async (db) => {
    const id = validate(entityIdSchema, contactId);
    const [row] = await db.select().from(contacts).where(all(eq(contacts.id, id), isNull(contacts.deletedAt)));
    return found(row);
  });
}

export async function listContacts(input: unknown = {}) {
  return withData(async (db) => {
    const { page, pageSize, search, companyId } = validate(contactListSchema, input);
    const pattern = search && searchPattern(search);
    const where = all(isNull(contacts.deletedAt), companyId ? eq(contacts.companyId, companyId) : undefined,
      pattern ? or(ilike(contacts.fullName, pattern), ilike(contacts.phone, pattern), ilike(contacts.email, pattern),
        ilike(contacts.phoneNormalized, pattern), ilike(contacts.emailNormalized, pattern)) : undefined);
    const [items, [total]] = await Promise.all([
      db.select().from(contacts).where(where).orderBy(desc(contacts.createdAt), desc(contacts.id)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ value: count() }).from(contacts).where(where),
    ]);
    return { items, total: total.value, page, pageSize };
  });
}
