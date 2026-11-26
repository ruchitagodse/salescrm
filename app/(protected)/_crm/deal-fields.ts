import { DEAL_OUTCOMES, PIPELINE_STAGE_KEYS, PIPELINE_STAGE_LABELS } from "@/lib/deal-values";
import type { Field } from "./types";

export const stageField: Field = { name: "stageKey", label: "Stage", type: "select", required: true,
  options: PIPELINE_STAGE_KEYS.map((value) => ({ value, label: PIPELINE_STAGE_LABELS[value] })) };
export const dealFields = (edit = false): Field[] => [
  { name: "title", label: "Deal title", required: true }, stageField,
  { name: "valueRupees", label: "Deal value (₹)", hint: "Optional. Enter non-negative rupees without commas, up to two decimal places." },
  { name: "expectedCloseDate", label: "Expected close date", type: "date" },
  ...(edit ? [
    { name: "outcome", label: "Outcome", type: "select" as const, required: true,
      options: DEAL_OUTCOMES.map((value) => ({ value, label: value })) },
    { name: "lossReason", label: "Loss reason", type: "textarea" as const, hint: "Required when outcome is lost." },
  ] : []),
  { name: "notes", label: "Notes", type: "textarea" },
];
