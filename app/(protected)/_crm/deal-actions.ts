"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { convertLeadToDeal, softDeleteDeal, updateDeal } from "@/lib/data";
import { completeDealSchema, convertDealSchema, updateDealSchema } from "@/lib/deal-validation";
import { entityIdSchema } from "@/lib/validation";
import { rupeesToPaise } from "@/lib/money";
import { failure, formValues, invalidForm, refreshRecords } from "./action-helpers";
import type { FormState } from "./types";

function input(data: FormData) {
  const values = formValues(data, ["title", "stageKey", "expectedCloseDate", "notes"]);
  const money = data.get("valueRupees");
  if (typeof money !== "string") throw new RangeError();
  return { ...values, expectedCloseDate: values.expectedCloseDate || null, valuePaise: rupeesToPaise(money) };
}
const moneyError = (): FormState => ({ errors: { valueRupees: "Enter non-negative rupees with no more than two decimal places, within the supported range." } });

export async function convertAction(leadId: string, _previous: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  if (!entityIdSchema.safeParse(leadId).success) return { errors: { _form: "Invalid lead." } };
  let values;
  try { values = input(data); } catch { return moneyError(); }
  const parsed = convertDealSchema.safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error.issues);
  try {
    const result = await convertLeadToDeal(leadId, parsed.data);
    refreshRecords();
    return { errors: {}, message: result.existing ? "This lead already has a deal. No duplicate was created." : "Deal created and lead converted.",
      success: { id: result.deal.id, label: result.deal.title, kind: "deals" } };
  } catch (error) { return failure(error); }
}

export async function saveDealAction(id: string, _previous: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  if (!entityIdSchema.safeParse(id).success) return { errors: { _form: "Invalid deal." } };
  let values;
  try { values = input(data); } catch { return moneyError(); }
  const parsed = completeDealSchema.safeParse({ ...values, ...formValues(data, ["outcome", "lossReason"]) });
  if (!parsed.success) return invalidForm(parsed.error.issues);
  try { await updateDeal(id, parsed.data); refreshRecords(); return { errors: {}, message: "Deal saved." }; }
  catch (error) { return failure(error); }
}

export async function moveDealAction(id: string, _previous: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  if (!entityIdSchema.safeParse(id).success) return { errors: { _form: "Invalid deal." } };
  const parsed = updateDealSchema.safeParse(formValues(data, ["stageKey"]));
  if (!parsed.success) return invalidForm(parsed.error.issues);
  try { await updateDeal(id, parsed.data); refreshRecords(); return { errors: {}, message: "Stage updated." }; }
  catch (error) { return failure(error); }
}

export async function deleteDealAction(id: string, _previous: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  if (!entityIdSchema.safeParse(id).success || data.get("confirm") !== "yes") return { errors: { _form: "Confirm deletion of a valid deal." } };
  try { await softDeleteDeal(id); refreshRecords(); } catch (error) { return failure(error); }
  redirect("/deals");
}
