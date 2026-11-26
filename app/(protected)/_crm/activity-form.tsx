"use client";

import { useActionState, useState } from "react";
import { ACTIVITY_STATUSES, ACTIVITY_TARGETS, ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS, type ActivityTargetType } from "@/lib/activity-values";
import { RecordForm } from "./form";
import type { Field, FormAction, Option } from "./types";

export type ActivityOptions = Record<ActivityTargetType, Option[]>;
export function ActivityForm({ action, options, values = {}, create = false }: {
  action: FormAction; options: ActivityOptions; values?: Record<string, string>; create?: boolean;
}) {
  const [targetType, setTargetType] = useState<ActivityTargetType>(ACTIVITY_TARGETS.find((type) => type === values.targetType) ?? "contact");
  const [targetId, setTargetId] = useState(values.targetId ?? "");
  const fields: Field[] = [
    { name: "title", label: "Title", required: true },
    { name: "type", label: "Activity type", type: "select", required: true, options: ACTIVITY_TYPES.map((value) => ({ value, label: ACTIVITY_TYPE_LABELS[value] })) },
    { name: "targetType", label: "Link to", type: "select", required: true, options: ACTIVITY_TARGETS.map((value) => ({ value, label: value })) },
    { name: "targetId", label: "Linked record", type: "select", required: true, options: [{ value: "", label: "Select a record" }, ...options[targetType]] },
    { name: "dueAtLocal", label: "Due date and time (India)", type: "datetime-local", required: true, hint: "Asia/Kolkata (UTC+05:30). This time is not converted using your device timezone." },
    { name: "status", label: "Status", type: "select", required: true, options: ACTIVITY_STATUSES.map((value) => ({ value, label: value })) },
    { name: "notes", label: "Notes", type: "textarea" },
  ];
  return <RecordForm action={action} fields={fields} kind="activities" create={create} values={{ type: "follow_up", status: "planned", ...values }}
    selectValues={{ targetType, targetId }} onSelectChange={(name, value) => {
      if (name === "targetType" && ACTIVITY_TARGETS.some((type) => type === value)) { setTargetType(value as ActivityTargetType); setTargetId(""); }
      if (name === "targetId") setTargetId(value);
    }} />;
}
export function ActivityStatusButton({ action, title, reopen = false }: { action: FormAction; title: string; reopen?: boolean }) {
  const [state, submit, pending] = useActionState(action, { errors: {} });
  return <form action={submit}><button className="secondary" disabled={pending} type="submit" aria-label={`${reopen ? "Reopen" : "Complete"} ${title}`}>{pending ? "Saving…" : reopen ? "Reopen" : "Complete"}</button>
    {state.errors._form && <p className="error" role="alert">{state.errors._form}</p>}
    {state.message && <span className="sr-only" role="status">{state.message}</span>}
  </form>;
}
