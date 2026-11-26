import "server-only";

import { asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { contacts, deals, leads, pipelineStages } from "@/db/schema";
import { completeDealSchema, convertDealSchema, dealListSchema, updateDealSchema } from "@/lib/deal-validation";
import { existingConversion, PIPELINE_STAGE_KEYS, type PipelineStageKey } from "@/lib/deal-values";
import { convertedAtForStatus } from "@/lib/contact-merge";
import { entityIdSchema } from "@/lib/validation";
import { all, DataError, found, omitUndefined, requireLiveContact, searchPattern, validate, withData, type Transaction } from "./shared";

const dto = <T extends { valuePaise: bigint | null }>(row: T): Omit<T, "valuePaise"> & { valuePaise: string | null } => {
  const { valuePaise, ...rest } = row;
  return { ...rest, valuePaise: valuePaise?.toString() ?? null };
};

async function stage(tx: Transaction, key: PipelineStageKey) {
  const [row] = await tx.select().from(pipelineStages).where(all(eq(pipelineStages.key, key), isNull(pipelineStages.deletedAt))).for("update");
  if (!row) throw new DataError("INVALID_REFERENCE");
  return row;
}

export async function pipelineReady() {
  return withData(async (db) => {
    // Catalog-only gate keeps existing lead pages usable before migration.
    const [result] = await db.execute<{ ready: boolean }>(sql`select
      exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname='deals' and c.relrowsecurity)
      and exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname='pipeline_stages' and c.relrowsecurity)
      and not exists(select 1 from pg_policies where schemaname='public' and tablename in ('deals','pipeline_stages')) as ready`);
    if (!result.ready) return false;
    const rows = await db.select({ key: pipelineStages.key }).from(pipelineStages).where(isNull(pipelineStages.deletedAt));
    return PIPELINE_STAGE_KEYS.every((key) => rows.some((row) => row.key === key));
  });
}

export async function convertLeadToDeal(leadId: string, input: unknown) {
  return withData(async (db) => {
    const id = validate(entityIdSchema, leadId);
    const values = validate(convertDealSchema, input);
    return db.transaction(async (tx) => {
      const [leadRow] = await tx.select().from(leads).where(all(eq(leads.id, id), isNull(leads.deletedAt))).for("update");
      const lead = found(leadRow);
      const [previous] = await tx.select().from(deals).where(eq(deals.leadId, id));
      const decision = existingConversion(previous);
      if (decision.kind === "archived") throw new DataError("CONFLICT");
      if (decision.kind === "existing") return { deal: dto(found(previous)), existing: true };
      await requireLiveContact(tx, lead.contactId);
      const selectedStage = await stage(tx, values.stageKey);
      const [created] = await tx.insert(deals).values({
        title: values.title, leadId: id, stageId: selectedStage.id, valuePaise: values.valuePaise,
        expectedCloseDate: values.expectedCloseDate, notes: values.notes, outcome: "open",
      }).returning();
      await tx.update(leads).set({ status: "converted", convertedAt: convertedAtForStatus(lead.status, lead.convertedAt, "converted", new Date()) ?? new Date() })
        .where(all(eq(leads.id, id), isNull(leads.deletedAt)));
      return { deal: dto(found(created)), existing: false };
    });
  });
}

export async function findDealForLead(leadId: string) {
  return withData(async (db) => {
    const id = validate(entityIdSchema, leadId);
    const [row] = await db.select().from(deals).where(eq(deals.leadId, id));
    // A tombstone tells conversion UI not to offer a duplicate creation.
    return row ? { id: row.id, archived: Boolean(row.deletedAt) } : null;
  });
}

export async function getDeal(dealId: string) {
  return withData(async (db) => {
    const id = validate(entityIdSchema, dealId);
    const [row] = await db.select({ deal: deals, stageKey: pipelineStages.key, contactId: leads.contactId, contactName: contacts.fullName })
      .from(deals).innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .innerJoin(leads, eq(deals.leadId, leads.id)).innerJoin(contacts, eq(leads.contactId, contacts.id))
      .where(all(eq(deals.id, id), isNull(deals.deletedAt)));
    const result = found(row);
    return { ...dto(result.deal), stageKey: result.stageKey, contactId: result.contactId, contactName: result.contactName };
  });
}

export async function updateDeal(dealId: string, input: unknown) {
  return withData(async (db) => {
    const id = validate(entityIdSchema, dealId);
    const patch = omitUndefined(validate(updateDealSchema, input));
    return db.transaction(async (tx) => {
      const [row] = await tx.select({ deal: deals, stageKey: pipelineStages.key }).from(deals)
        .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
        .where(all(eq(deals.id, id), isNull(deals.deletedAt))).for("update", { of: deals });
      const current = found(row);
      const values = validate(completeDealSchema, {
        title: current.deal.title, stageKey: current.stageKey, valuePaise: current.deal.valuePaise,
        expectedCloseDate: current.deal.expectedCloseDate, outcome: current.deal.outcome,
        lossReason: current.deal.lossReason, notes: current.deal.notes, ...patch,
      });
      const selectedStage = await stage(tx, values.stageKey);
      const [updated] = await tx.update(deals).set({
        title: values.title, stageId: selectedStage.id, valuePaise: values.valuePaise,
        expectedCloseDate: values.expectedCloseDate, outcome: values.outcome, lossReason: values.lossReason, notes: values.notes,
      }).where(all(eq(deals.id, id), isNull(deals.deletedAt))).returning();
      return dto(found(updated));
    });
  });
}

export async function softDeleteDeal(dealId: string) {
  return withData(async (db) => {
    const id = validate(entityIdSchema, dealId);
    const [row] = await db.update(deals).set({ deletedAt: new Date() })
      .where(all(eq(deals.id, id), isNull(deals.deletedAt))).returning({ id: deals.id });
    return found(row);
  });
}

export async function listDeals(input: unknown = {}) {
  return withData(async (db) => {
    const { search, page, pageSize, outcome, stageKey } = validate(dealListSchema, input);
    const pattern = search ? searchPattern(search) : null;
    const where = all(isNull(deals.deletedAt), outcome ? eq(deals.outcome, outcome) : undefined,
      stageKey ? eq(pipelineStages.key, stageKey) : undefined,
      pattern ? or(ilike(deals.title, pattern), ilike(contacts.fullName, pattern), ilike(contacts.email, pattern), ilike(contacts.phone, pattern)) : undefined);
    const rows = await db.select({ deal: deals, stageKey: pipelineStages.key, contactName: contacts.fullName, contactId: leads.contactId })
      .from(deals).innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .innerJoin(leads, eq(deals.leadId, leads.id)).innerJoin(contacts, eq(leads.contactId, contacts.id))
      .where(where).orderBy(desc(deals.createdAt), asc(deals.id)).limit(pageSize).offset((page - 1) * pageSize);
    const [total] = await db.select({ value: count() }).from(deals).innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .innerJoin(leads, eq(deals.leadId, leads.id)).innerJoin(contacts, eq(leads.contactId, contacts.id)).where(where);
    return { items: rows.map((row) => ({ ...dto(row.deal), stageKey: row.stageKey, contactName: row.contactName, contactId: row.contactId })), total: total.value, page, pageSize };
  });
}
