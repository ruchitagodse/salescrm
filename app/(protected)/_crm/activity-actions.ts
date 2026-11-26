"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createActivity, updateActivity, softDeleteActivity } from "@/lib/data";
import { createActivitySchema, updateActivitySchema } from "@/lib/activity-validation";
import { entityIdSchema } from "@/lib/validation";
import { parseIndiaDateTime } from "@/lib/activity-time";
import type { ActivityStatus } from "@/lib/activity-values";
import { failure, formValues, invalidForm, refreshRecords } from "./action-helpers";
import type { FormState } from "./types";

export async function saveActivityAction(id: string | null, _previous: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  if (id !== null && !entityIdSchema.safeParse(id).success) return { errors: { _form: "Invalid activity." } };
  const values = formValues(data, ["title", "type", "status", "targetType", "targetId", "notes"]);
  let dueAt;
  try { dueAt = parseIndiaDateTime(String(data.get("dueAtLocal") ?? "")); }
  catch { return { errors: { dueAtLocal: "Enter a valid date and time in India time." } }; }
  const parsed = createActivitySchema.safeParse({ ...values, dueAt });
  if (!parsed.success) return invalidForm(parsed.error.issues);
  try {
    const activity = id ? await updateActivity(id, parsed.data) : await createActivity(parsed.data);
    refreshRecords();
    return { errors: {}, message: id ? "Activity saved." : "Activity created.",
      success: id ? undefined : { id: activity.id, label: activity.title, kind: "activities" } };
  } catch (error) { return failure(error); }
}
export async function activityStatusAction(id: string, status: ActivityStatus): Promise<FormState> {
  await requireUser();
  if (!entityIdSchema.safeParse(id).success) return { errors: { _form: "Invalid activity." } };
  const parsed = updateActivitySchema.safeParse({ status });
  if (!parsed.success) return invalidForm(parsed.error.issues);
  try { await updateActivity(id, parsed.data); refreshRecords(); return { errors: {}, message: "Activity updated." }; }
  catch (error) { return failure(error); }
}
export async function deleteActivityAction(id: string, _previous: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  if (!entityIdSchema.safeParse(id).success || data.get("confirm") !== "yes") return { errors: { _form: "Confirm deletion of a valid activity." } };
  try { await softDeleteActivity(id); refreshRecords(); } catch (error) { return failure(error); }
  redirect("/activities");
}
