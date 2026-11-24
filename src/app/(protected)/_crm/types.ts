export type EntityKind = "companies" | "contacts" | "leads";
export type FormState = {
  errors: Record<string, string>;
  message?: string;
  warnings?: string[];
  success?: { id: string; label: string; kind: EntityKind; contactId?: string; contactName?: string; reused?: boolean };
};
export type FormAction = (previous: FormState, data: FormData) => Promise<FormState>;
export type Option = { value: string; label: string };
export type Field = {
  name: string; label: string; type?: "text" | "email" | "tel" | "date" | "textarea" | "select";
  required?: boolean; hint?: string; options?: Option[];
};
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export type DetailParams = Promise<{ id: string }>;
