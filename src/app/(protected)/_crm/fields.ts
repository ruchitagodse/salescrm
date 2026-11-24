import type { Field, Option } from "./types";

export const companyFields: Field[] = [
  { name: "name", label: "Company name", required: true },
  { name: "website", label: "Website" }, { name: "industry", label: "Industry" },
  { name: "city", label: "City" }, { name: "notes", label: "Notes", type: "textarea" },
];
export const contactFields = (companies: Option[]): Field[] => [
  { name: "fullName", label: "Full name", required: true },
  { name: "phone", label: "Phone", type: "tel", hint: "Indian numbers may be entered with 10 digits; use +country code for other countries." },
  { name: "email", label: "Email", type: "email" },
  { name: "instagramHandle", label: "Instagram handle", hint: "Provide at least one of phone, email or Instagram handle." },
  { name: "city", label: "City" },
  { name: "companyId", label: "Company", type: "select", options: [{ value: "", label: "No company" }, ...companies] },
  { name: "notes", label: "Notes", type: "textarea" },
];
