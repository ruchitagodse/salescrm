import { LEAD_SOURCES, LEAD_STATUSES } from "@/lib/lead-values";
import type { Field } from "./types";

export const leadFields = (edit = false): Field[] => [
  { name: "source", label: "Source", type: "select", required: true,
    options: [{ value: "", label: "Select source" }, ...LEAD_SOURCES.map((value) => ({ value, label: value.replaceAll("_", " ") }))] },
  { name: "sourceDetail", label: "Source detail", hint: "Campaign, ad, form name or other origin details." },
  { name: "serviceNeeds", label: "Services needed" },
  { name: "deadline", label: "Deadline", type: "date" },
  { name: "budgetRupees", label: "Budget (₹)", hint: "Enter rupees without commas, for example 125000.50. Maximum two decimal places." },
  ...(edit ? [
    { name: "status", label: "Status", type: "select" as const, required: true,
      options: LEAD_STATUSES.map((value) => ({ value, label: value })) },
    { name: "lostReason", label: "Lost reason", hint: "Required when status is lost.", type: "textarea" as const },
  ] : []),
  { name: "requirement", label: "Requirement", type: "textarea" },
  { name: "notes", label: "Notes", type: "textarea" },
];
