import "server-only";

import { randomUUID } from "node:crypto";
import { asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { contacts, leads } from "@/db/schema";
import { contactFillPatch, convertedAtForStatus, selectContactMatch } from "@/lib/contact-merge";
import {
  createLeadSchema, createLeadWithContactSchema, entityIdSchema, leadListSchema, updateLeadSchema,
} from "@/lib/validation";
import {
  all, found, lockContactKeys, normalizedFields, omitUndefined, requireLiveCompany,
  requireLiveContact, searchPattern, toLeadDTO, validate, withData,
} from "./shared";

export async function createLead(input: unknown) {
  return withData(async (db) => {
    const values = validate(createLeadSchema, input);
    return db.transaction(async (tx) => {
      await requireLiveContact(tx, values.contactId);
      const [row] = await tx.insert(leads).values({
        id: randomUUID(), ...values,
        convertedAt: convertedAtForStatus(null, null, values.status, new Date()),
      }).returning();
      return toLeadDTO(found(row));
    });
  });
}

export async function updateLead(leadId: string, input: unknown) {
  return withData(async (db) => {
    const id = validate(entityIdSchema, leadId);
    const patch = omitUndefined(validate(updateLeadSchema, input));
    return db.transaction(async (tx) => {
      const [row] = await tx.select().from(leads).where(all(eq(leads.id, id), isNull(leads.deletedAt))).for("update");
      const current = found(row);
      const values = validate(createLeadSchema, {
        contactId: current.contactId, source: current.source, status: current.status,
        entryMethod: current.entryMethod, sourceDetail: current.sourceDetail,
        serviceNeeds: current.serviceNeeds, requirement: current.requirement, deadline: current.deadline,
        budgetPaise: current.budgetPaise, lostReason: current.lostReason, notes: current.notes, ...patch,
      });
      if (patch.contactId !== undefined) await requireLiveContact(tx, values.contactId);
      const [updated] = await tx.update(leads).set({
        ...values,
        convertedAt: convertedAtForStatus(current.status, current.convertedAt, values.status, new Date()),
      }).where(all(eq(leads.id, id), isNull(leads.deletedAt))).returning();
      return toLeadDTO(found(updated));
    });
  });
}

export async function softDeleteLead(leadId: string) {
  return withData(async (db) => {
    const id = validate(entityIdSchema, leadId);
    const [row] = await db.update(leads).set({ deletedAt: new Date() })
      .where(all(eq(leads.id, id), isNull(leads.deletedAt))).returning({ id: leads.id });
    return found(row);
  });
}

export async function getLead(leadId: string) {
  return withData(async (db) => {
    const id = validate(entityIdSchema, leadId);
    const [row] = await db.select().from(leads).where(all(eq(leads.id, id), isNull(leads.deletedAt)));
    return toLeadDTO(found(row));
  });
}

export async function listLeads(input: unknown = {}) {
  return withData(async (db) => {
    const { page, pageSize, search, source, status, contactId } = validate(leadListSchema, input);
    const pattern = search && searchPattern(search);
    const where = all(isNull(leads.deletedAt), source ? eq(leads.source, source) : undefined,
      status ? eq(leads.status, status) : undefined, contactId ? eq(leads.contactId, contactId) : undefined,
      pattern ? or(ilike(contacts.fullName, pattern), ilike(contacts.phone, pattern), ilike(contacts.email, pattern),
        ilike(contacts.phoneNormalized, pattern), ilike(contacts.emailNormalized, pattern)) : undefined);
    const [rows, [total]] = await Promise.all([
      db.select({ lead: leads, contactName: contacts.fullName }).from(leads).innerJoin(contacts, eq(leads.contactId, contacts.id))
        .where(where).orderBy(desc(leads.createdAt), desc(leads.id)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ value: count() }).from(leads).innerJoin(contacts, eq(leads.contactId, contacts.id)).where(where),
    ]);
    return { items: rows.map(({ lead, contactName }) => ({ ...toLeadDTO(lead), contactName })), total: total.value, page, pageSize };
  });
}

export async function createLeadWithContact(input: unknown) {
  return withData(async (db) => {
    const { contact: incoming, lead } = validate(createLeadWithContactSchema, input);
    const normalized = normalizedFields(incoming);
    return db.transaction(async (tx) => {
      await lockContactKeys(tx, normalized.phoneNormalized, normalized.emailNormalized);
      const keys = [
        normalized.phoneNormalized ? eq(contacts.phoneNormalized, normalized.phoneNormalized) : undefined,
        normalized.emailNormalized ? eq(contacts.emailNormalized, normalized.emailNormalized) : undefined,
      ];
      // An instagram-only enquiry has no deduplication key. Never query all
      // contacts when the OR predicate is empty.
      const matches = keys.some(Boolean)
        ? await tx.select().from(contacts).where(all(isNull(contacts.deletedAt), or(...keys)))
          .orderBy(asc(contacts.id)).for("update")
        : [];
      const matchId = selectContactMatch(matches);
      let contact: typeof contacts.$inferSelect;
      if (matchId) {
        const existing = found(matches.find((row) => row.id === matchId));
        const patch = contactFillPatch(existing, incoming);
        if (Object.keys(patch).length) {
          if (patch.companyId) await requireLiveCompany(tx, patch.companyId);
          const [updated] = await tx.update(contacts).set({
            ...patch, ...normalizedFields({ ...existing, ...patch }),
          }).where(all(eq(contacts.id, existing.id), isNull(contacts.deletedAt))).returning();
          contact = found(updated);
        } else contact = existing;
      } else {
        await requireLiveCompany(tx, incoming.companyId);
        const [created] = await tx.insert(contacts).values({ id: randomUUID(), ...incoming, ...normalized }).returning();
        contact = found(created);
      }
      const [createdLead] = await tx.insert(leads).values({
        id: randomUUID(), contactId: contact.id, ...lead,
        convertedAt: convertedAtForStatus(null, null, lead.status, new Date()),
      }).returning();
      return { lead: toLeadDTO(found(createdLead)), contact, reusedContact: Boolean(matchId) };
    });
  });
}
