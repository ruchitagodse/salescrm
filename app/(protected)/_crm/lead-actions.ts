"use server";

import { requireUser } from "@/lib/auth";
import { createLeadWithContact, getLead, updateLead } from "@/lib/data";
import { createLeadSchema, createLeadWithContactSchema, entityIdSchema } from "@/lib/validation";
import { rupeesToPaise } from "@/lib/money";
import { failure, formValues, invalidForm, refreshRecords } from "./action-helpers";
import type { FormState } from "./types";

function leadInput(data: FormData) {
  const values = formValues(data, ["source", "sourceDetail", "serviceNeeds", "requirement", "deadline", "notes", "lostReason", "status"]);
  const budget = data.get("budgetRupees");
  if (typeof budget !== "string") throw new RangeError();
  return { ...values, deadline: values.deadline || null, budgetPaise: rupeesToPaise(budget), entryMethod: "manual" as const };
}
const budgetError = (): FormState => ({ errors: { budgetRupees: "Enter non-negative rupees within the supported range, with at most two decimal places." }, message: "Check the budget." });

export async function addEnquiry(_previous: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  let lead;
  try { lead = { ...leadInput(data), status: "new" }; }
  catch { return budgetError(); }
  const raw = formValues(data, ["fullName", "phone", "email", "instagramHandle", "city", "companyId"]);
  const parsed = createLeadWithContactSchema.safeParse({ contact: { ...raw, companyId: raw.companyId || null }, lead });
  if (!parsed.success) {
    const state = invalidForm(parsed.error.issues);
    if (!raw.phone.trim() && !raw.email.trim() && !raw.instagramHandle.trim()) state.errors.phone = "Provide a phone, email or Instagram handle.";
    return state;
  }
  try {
    const result = await createLeadWithContact(parsed.data);
    refreshRecords();
    return { errors: {}, message: "Lead created.", success: {
      id: result.lead.id, label: "Lead", kind: "leads", contactId: result.contact.id,
      contactName: result.contact.fullName, reused: result.reusedContact,
    } };
  } catch (error) { return failure(error); }
}

export async function saveLead(id: string, _previous: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  if (!entityIdSchema.safeParse(id).success) return { errors: { _form: "Invalid lead." } };
  let values;
  try { values = leadInput(data); } catch { return budgetError(); }
  try {
    const current = await getLead(id);
    const parsed = createLeadSchema.safeParse({ ...values, contactId: current.contactId });
    if (!parsed.success) {
      const state = invalidForm(parsed.error.issues);
      if (values.status === "lost" && !values.lostReason.trim()) state.errors.lostReason = "A lost reason is required.";
      return state;
    }
    // Preserve an existing contact link even if that contact was soft-deleted.
    await updateLead(id, { ...parsed.data, contactId: undefined });
    refreshRecords();
    return { errors: {}, message: "Lead saved." };
  } catch (error) { return failure(error); }
}
