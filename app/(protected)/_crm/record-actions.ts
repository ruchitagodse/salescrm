"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createCompany, updateCompany, createContact, updateContact, getContact,
  softDeleteCompany, softDeleteContact, softDeleteLead } from "@/lib/data";
import { createCompanySchema, createContactSchema, entityIdSchema } from "@/lib/validation";
import { failure, formValues, invalidForm, refreshRecords } from "./action-helpers";
import type { EntityKind, FormState } from "./types";

export async function saveCompany(id: string | null, _previous: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  const parsed = createCompanySchema.safeParse(formValues(data, ["name", "website", "industry", "city", "notes"]));
  if (!parsed.success) return invalidForm(parsed.error.issues);
  if (id !== null && !entityIdSchema.safeParse(id).success) return { errors: { _form: "Invalid company." } };
  try {
    const result = id ? await updateCompany(id, parsed.data) : await createCompany(parsed.data);
    refreshRecords();
    return { errors: {}, message: id ? "Company saved." : "Company created.", warnings: result.warnings,
      success: id ? undefined : { id: result.company.id, label: result.company.name, kind: "companies" } };
  } catch (error) { return failure(error); }
}

export async function saveContact(id: string | null, _previous: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  const input = formValues(data, ["fullName", "phone", "email", "instagramHandle", "city", "notes", "companyId"]);
  const parsed = createContactSchema.safeParse({ ...input, companyId: input.companyId || null });
  if (!parsed.success) {
    const state = invalidForm(parsed.error.issues);
    if (!input.phone.trim() && !input.email.trim() && !input.instagramHandle.trim()) {
      state.errors.phone = "Provide a phone, email or Instagram handle.";
    }
    return state;
  }
  if (id !== null && !entityIdSchema.safeParse(id).success) return { errors: { _form: "Invalid contact." } };
  try {
    const values = { ...parsed.data };
    // An unchanged link to a deleted company is retained, not reassigned.
    if (id && (await getContact(id)).companyId === values.companyId) delete values.companyId;
    const contact = id ? await updateContact(id, values) : await createContact(values);
    refreshRecords();
    return { errors: {}, message: id ? "Contact saved." : "Contact created.",
      success: id ? undefined : { id: contact.id, label: contact.fullName, kind: "contacts" } };
  } catch (error) { return failure(error); }
}

export async function deleteRecord(kind: EntityKind, id: string, _previous: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  if (!["companies", "contacts", "leads"].includes(kind) || !entityIdSchema.safeParse(id).success || data.get("confirm") !== "yes") {
    return { errors: { _form: "Confirm deletion of a valid record." } };
  }
  try {
    if (kind === "companies") await softDeleteCompany(id);
    else if (kind === "contacts") await softDeleteContact(id);
    else await softDeleteLead(id);
    refreshRecords();
  } catch (error) { return failure(error); }
  redirect(`/${kind}`);
}
