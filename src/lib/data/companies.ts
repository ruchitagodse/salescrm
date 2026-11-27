import "server-only";

import { randomUUID } from "node:crypto";
import { count, desc, eq, ilike, isNull, ne, sql } from "drizzle-orm";
import { companies } from "@/db/schema";
import { companyListSchema, createCompanySchema, entityIdSchema, updateCompanySchema } from "@/lib/validation";
import { all, found, searchPattern, validate, withData, type Transaction } from "./shared";

async function duplicateWarning(tx: Transaction, name: string, excludeId?: string) {
  // A duplicate is allowed; serializing name checks makes concurrent warnings useful.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('company-name:' || lower(${name}), 0))`);
  const [match] = await tx.select({ id: companies.id }).from(companies).where(all(
    isNull(companies.deletedAt), sql`lower(${companies.name}) = lower(${name})`,
    excludeId ? ne(companies.id, excludeId) : undefined,
  )).limit(1);
  return match ? ["A company with this name already exists."] : [];
}

export async function createCompany(input: unknown, reuseExisting = false) {
  return withData(async (db) => {
    const values = validate(createCompanySchema, input);
    return db.transaction(async (tx) => {
      const warnings = await duplicateWarning(tx, values.name);
      if (reuseExisting && warnings.length) {
        const [existing] = await tx.select().from(companies).where(all(isNull(companies.deletedAt),sql`lower(${companies.name})=lower(${values.name})`)).orderBy(companies.createdAt,companies.id).limit(1);
        return {company:found(existing),warnings:['Selected the existing company with this name. Its stored details were preserved.']};
      }
      const [row] = await tx.insert(companies).values({ id: randomUUID(), ...values }).returning();
      return { company: found(row), warnings };
    });
  });
}

export async function updateCompany(companyId: string, input: unknown) {
  return withData(async (db) => {
    const id = validate(entityIdSchema, companyId);
    const values = validate(updateCompanySchema, input);
    return db.transaction(async (tx) => {
      const [current] = await tx.select().from(companies).where(all(eq(companies.id, id), isNull(companies.deletedAt))).for("update");
      found(current);
      const warnings = await duplicateWarning(tx, values.name ?? current.name, id);
      const [row] = await tx.update(companies).set(values).where(all(eq(companies.id, id), isNull(companies.deletedAt))).returning();
      return { company: found(row), warnings };
    });
  });
}

export async function softDeleteCompany(companyId: string) {
  return withData(async (db) => {
    const id = validate(entityIdSchema, companyId);
    const [row] = await db.update(companies).set({ deletedAt: new Date() })
      .where(all(eq(companies.id, id), isNull(companies.deletedAt))).returning({ id: companies.id });
    return found(row);
  });
}

export async function getCompany(companyId: string) {
  return withData(async (db) => {
    const id = validate(entityIdSchema, companyId);
    const [row] = await db.select().from(companies).where(all(eq(companies.id, id), isNull(companies.deletedAt)));
    return found(row);
  });
}

export async function listCompanies(input: unknown = {}) {
  return withData(async (db) => {
    const { page, pageSize, search } = validate(companyListSchema, input);
    const where = all(isNull(companies.deletedAt), search ? ilike(companies.name, searchPattern(search)) : undefined);
    const [items, [total]] = await Promise.all([
      db.select().from(companies).where(where).orderBy(desc(companies.createdAt), desc(companies.id)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ value: count() }).from(companies).where(where),
    ]);
    return { items, total: total.value, page, pageSize };
  });
}
