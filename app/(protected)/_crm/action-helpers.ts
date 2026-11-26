import "server-only";

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { DataError } from "@/lib/data";
import type { FormState } from "./types";

export function formValues<const T extends readonly string[]>(data: FormData, names: T): Record<T[number], string> {
  return Object.fromEntries(names.map((name) => [name, typeof data.get(name) === "string" ? data.get(name) as string : ""])) as Record<T[number], string>;
}
export function invalidForm(issues: z.core.$ZodIssue[]): FormState {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.filter((part) => part !== "contact" && part !== "lead");
    const key = path.join(".") || "_form";
    errors[key] ??= issue.message;
  }
  return { errors, message: "Please check the highlighted fields." };
}
export function failure(error: unknown): FormState {
  return { errors: { _form: error instanceof DataError && error.code !== "DATABASE_ERROR" ? error.message : "Unable to save. Please try again." } };
}
export function refreshRecords() {
  for (const path of ["/companies", "/contacts", "/leads", "/deals", "/activities", "/quotations", "/orders", "/payments", "/expenses"]) {
    revalidatePath(path);
    revalidatePath(`${path}/[id]`, "page");
  }
  revalidatePath("/contacts/new");
  revalidatePath("/leads/new");
  revalidatePath("/pipeline");
  revalidatePath("/leads/[id]/convert", "page");
  revalidatePath("/activities/new");
  revalidatePath("/quotations/new"); revalidatePath("/payments/new"); revalidatePath("/expenses/new");
}
