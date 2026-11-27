import "server-only";

import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { companies, contacts } from "@/db/schema";
import { ContactMatchConflict } from "@/lib/contact-merge";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";

type Database = typeof import("@/db").db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Pick<Database, "select" | "execute">;

export class DataError extends Error {
  constructor(public readonly code: "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "IDENTITY_CONFLICT" | "INVALID_REFERENCE" | "RETRY" | "DATABASE_ERROR" | "INVALID_STATE" | "OVERPAYMENT") {
    super({
      INVALID_INPUT: "Invalid input.", NOT_FOUND: "Record not found.",
      CONFLICT: "A record with these details already exists.",
      IDENTITY_CONFLICT: "Phone and email match different contacts; manual resolution is required.",
      INVALID_REFERENCE: "The linked record is unavailable.",
      RETRY: "The record changed concurrently. Please retry.",
      DATABASE_ERROR: "Unable to complete the operation.",
      INVALID_STATE: "This operation is not allowed in the record's current state.",
      OVERPAYMENT: "Payment exceeds the order's remaining balance.",
    }[code]);
  }
}

export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new DataError("INVALID_INPUT");
  return result.data;
}

// Trusted server callers must authenticate users or verify webhook signatures
// before invoking any data function. This reusable layer performs no auth.
export async function withData<T>(operation: (db: Database) => Promise<T>): Promise<T> {
  const started=performance.now();
  try {
    const { db } = await import("@/db");
    return await operation(db);
  } catch (error) {
    if (error instanceof DataError) throw error;
    if (error instanceof ContactMatchConflict) throw new DataError("IDENTITY_CONFLICT");
    const codes: string[] = [];
    let cause: unknown = error;
    for (let depth = 0; depth < 4 && cause instanceof Error; depth++) {
      const code = "code" in cause ? cause.code : null;
      if (typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code)) codes.push(code);
      if (code === "23505") throw new DataError("CONFLICT");
      if (code === "23503") throw new DataError("INVALID_REFERENCE");
      if (code === "23514") throw new DataError("INVALID_INPUT");
      if (code === "40001" || code === "40P01") throw new DataError("RETRY");
      cause = cause.cause;
    }
    // Do not propagate driver error messages, SQL parameters or raw causes.
    console.error("Business data operation failed.", { codes });
    throw new DataError("DATABASE_ERROR");
  } finally {
    const durationMs=Math.round(performance.now()-started);
    if(durationMs>1500)console.info('CRM data operation slow',{durationMs});
  }
}

export function found<T>(row: T | undefined): T {
  if (!row) throw new DataError("NOT_FOUND");
  return row;
}

export const searchPattern = (search: string) => `%${search.replace(/[\\%_]/g, "\\$&")}%`;
export const all = (...conditions: (SQL | undefined)[]) => and(...conditions);
export const normalizedFields = (value: { phone?: string | null; email?: string | null }) => ({
  phoneNormalized: normalizePhone(value.phone), emailNormalized: normalizeEmail(value.email),
});
export const omitUndefined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;

export async function lockContactKeys(tx: Pick<Database, "execute">, phone: string | null, email: string | null) {
  const keys = [phone && `contact-phone:${phone}`, email && `contact-email:${email}`]
    .filter((key): key is string => Boolean(key)).sort();
  for (const key of keys) await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
}

export async function requireLiveCompany(tx: Reader, companyId: string | null | undefined) {
  if (!companyId) return;
  const [row] = await tx.select({ id: companies.id }).from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt))).for("update");
  if (!row) throw new DataError("INVALID_REFERENCE");
}

export async function requireLiveContact(tx: Reader, contactId: string) {
  const [row] = await tx.select({ id: contacts.id }).from(contacts)
    .where(and(eq(contacts.id, contactId), isNull(contacts.deletedAt))).for("update");
  if (!row) throw new DataError("INVALID_REFERENCE");
}

export function toLeadDTO<T extends { budgetPaise: bigint | null }>(row: T): Omit<T, "budgetPaise"> & { budgetPaise: string | null } {
  const { budgetPaise, ...rest } = row;
  return { ...rest, budgetPaise: budgetPaise?.toString() ?? null };
}
