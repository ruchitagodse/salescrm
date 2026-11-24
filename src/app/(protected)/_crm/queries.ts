import "server-only";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { DataError, getCompany, getContact, getLead, listCompanies } from "@/lib/data";
import { entityIdSchema } from "@/lib/validation";
import type { Option } from "./types";

export async function companyOptions(): Promise<Option[]> {
  await requireUser();
  const first = await listCompanies({ pageSize: 100 });
  const items = [...first.items];
  for (let page = 2; (page - 1) * 100 < first.total; page++) {
    items.push(...(await listCompanies({ page, pageSize: 100 })).items);
  }
  return items.map((item) => ({ value: item.id, label: item.name }));
}
export async function optionalRecord<T>(load: () => Promise<T>): Promise<T | null> {
  try { return await load(); }
  catch (error) {
    if (error instanceof DataError && (error.code === "NOT_FOUND" || error.code === "INVALID_INPUT")) return null;
    throw new Error("Unable to load this record. Please try again.");
  }
}
export async function companyRecord(id: string) {
  await requireUser();
  if (!entityIdSchema.safeParse(id).success) notFound();
  const row = await optionalRecord(() => getCompany(id));
  if (!row) notFound();
  return row;
}
export async function contactRecord(id: string) {
  await requireUser();
  if (!entityIdSchema.safeParse(id).success) notFound();
  const row = await optionalRecord(() => getContact(id));
  if (!row) notFound();
  return row;
}
export async function leadRecord(id: string) {
  await requireUser();
  if (!entityIdSchema.safeParse(id).success) notFound();
  const row = await optionalRecord(() => getLead(id));
  if (!row) notFound();
  return row;
}
export function fieldValues(row: object): Record<string, string> {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value === null || typeof value === "string")
    .map(([key, value]) => [key, value ?? ""]));
}
