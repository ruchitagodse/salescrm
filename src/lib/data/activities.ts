import "server-only";

import { asc, count, desc, eq, gte, ilike, isNull, lt, or, sql } from "drizzle-orm";
import { activities, contacts, deals, leads } from "@/db/schema";
import { activityListSchema, completeActivitySchema, createActivitySchema, updateActivitySchema } from "@/lib/activity-validation";
import { activityTarget, activityTargetColumns, completionTime, type ActivityTargetType } from "@/lib/activity-values";
import { activityWindow } from "@/lib/activity-time";
import { entityIdSchema } from "@/lib/validation";
import { all, DataError, found, omitUndefined, searchPattern, validate, withData, type Transaction } from "./shared";

async function requireTarget(tx: Transaction, type: ActivityTargetType, id: string) {
  const table = type === "contact" ? contacts : type === "lead" ? leads : deals;
  const [row] = await tx.select({ id: table.id }).from(table).where(all(eq(table.id, id), isNull(table.deletedAt))).for("update");
  if (!row) throw new DataError("INVALID_REFERENCE");
}
function joined(row: { activity: typeof activities.$inferSelect; contactName: string | null; leadName: string | null; dealName: string | null }) {
  return { ...row.activity, ...activityTarget(row.activity), targetLabel: row.contactName || row.leadName || row.dealName || "Linked record" };
}
const selection = { activity: activities, contactName: contacts.fullName, leadName: leads.serviceNeeds, dealName: deals.title };

export async function activitiesReady() {
  return withData(async (db) => {
    const [row] = await db.execute<{ ready: boolean }>(sql`select exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='activities' and c.relrowsecurity)
      and not exists(select 1 from pg_policies where schemaname='public' and tablename='activities') as ready`);
    return row.ready;
  });
}
export async function createActivity(input: unknown) {
  return withData(async (db) => {
    const values = validate(createActivitySchema, input);
    return db.transaction(async (tx) => {
      await requireTarget(tx, values.targetType, values.targetId);
      const [row] = await tx.insert(activities).values({
        title: values.title, type: values.type, status: values.status, dueAt: values.dueAt, notes: values.notes,
        ...activityTargetColumns(values.targetType, values.targetId),
        completedAt: completionTime(null, null, values.status, new Date()),
      }).returning();
      return found(row);
    });
  });
}
export async function updateActivity(activityId: string, input: unknown) {
  return withData(async (db) => {
    const id = validate(entityIdSchema, activityId);
    const patch = omitUndefined(validate(updateActivitySchema, input));
    return db.transaction(async (tx) => {
      const [row] = await tx.select().from(activities).where(all(eq(activities.id, id), isNull(activities.deletedAt))).for("update");
      const current = found(row);
      const previousTarget = activityTarget(current);
      const values = validate(completeActivitySchema, { title: current.title, type: current.type, status: current.status,
        dueAt: current.dueAt, notes: current.notes, ...previousTarget, ...patch });
      if (values.targetType !== previousTarget.targetType || values.targetId !== previousTarget.targetId) await requireTarget(tx, values.targetType, values.targetId);
      const [updated] = await tx.update(activities).set({ title: values.title, type: values.type, status: values.status,
        dueAt: values.dueAt, notes: values.notes, ...activityTargetColumns(values.targetType, values.targetId),
        completedAt: completionTime(current.status, current.completedAt, values.status, new Date()),
      }).where(all(eq(activities.id, id), isNull(activities.deletedAt))).returning();
      return found(updated);
    });
  });
}
export async function softDeleteActivity(activityId: string) {
  return withData(async (db) => {
    const id = validate(entityIdSchema, activityId);
    const [row] = await db.update(activities).set({ deletedAt: new Date() }).where(all(eq(activities.id, id), isNull(activities.deletedAt))).returning({ id: activities.id });
    return found(row);
  });
}
export async function getActivity(activityId: string) {
  return withData(async (db) => {
    const id = validate(entityIdSchema, activityId);
    const [row] = await db.select(selection).from(activities).leftJoin(contacts, eq(activities.contactId, contacts.id))
      .leftJoin(leads, eq(activities.leadId, leads.id)).leftJoin(deals, eq(activities.dealId, deals.id))
      .where(all(eq(activities.id, id), isNull(activities.deletedAt)));
    return joined(found(row));
  });
}
export async function listActivities(input: unknown = {}) {
  return withData(async (db) => {
    const { search, view, type, targetType, targetId, page, pageSize } = validate(activityListSchema, input);
    const window = activityWindow(view, new Date());
    const pattern = search ? searchPattern(search) : null;
    const targetColumn = targetType === "contact" ? activities.contactId : targetType === "lead" ? activities.leadId : activities.dealId;
    const where = all(isNull(activities.deletedAt), window.status ? eq(activities.status, window.status) : undefined,
      window.from ? gte(activities.dueAt, window.from) : undefined, window.before ? lt(activities.dueAt, window.before) : undefined,
      type ? eq(activities.type, type) : undefined, targetId ? eq(targetColumn, targetId) : undefined,
      pattern ? or(ilike(activities.title, pattern), ilike(activities.notes, pattern), ilike(contacts.fullName, pattern), ilike(leads.serviceNeeds, pattern), ilike(deals.title, pattern)) : undefined);
    const rows = await db.select(selection).from(activities).leftJoin(contacts, eq(activities.contactId, contacts.id))
      .leftJoin(leads, eq(activities.leadId, leads.id)).leftJoin(deals, eq(activities.dealId, deals.id)).where(where)
      .orderBy(view === "completed" ? desc(activities.completedAt) : asc(activities.dueAt), asc(activities.id)).limit(pageSize).offset((page - 1) * pageSize);
    const [total] = await db.select({ value: count() }).from(activities).leftJoin(contacts, eq(activities.contactId, contacts.id))
      .leftJoin(leads, eq(activities.leadId, leads.id)).leftJoin(deals, eq(activities.dealId, deals.id)).where(where);
    return { items: rows.map(joined), total: total.value, page, pageSize };
  });
}
