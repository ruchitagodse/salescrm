"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import type { EntityKind, Field, FormAction } from "./types";

export function RecordForm({ action, fields, values = {}, create = false, kind, onCreated, companyValue, onCompanyChange, selectValues, onSelectChange }: {
  action: FormAction; fields: Field[]; values?: Record<string, string>; create?: boolean; kind: EntityKind;
  onCreated?: (company: { value: string; label: string }) => void;
  companyValue?: string; onCompanyChange?: (value: string) => void;
  selectValues?: Record<string, string>; onSelectChange?: (name: string, value: string) => void;
}) {
  const [state, submit, pending] = useActionState(async (previous: Parameters<FormAction>[0], data: FormData) => {
    const result = await action(previous, data);
    if (result.success && onCreated) onCreated({ value: result.success.id, label: result.success.label });
    return result;
  }, { errors: {} });
  const [status, setStatus] = useState(values.status ?? values.outcome ?? "new");
  const prefix = useId();
  if (create && state.success) return <section className="form-result" aria-live="polite">
    <p role="status">{state.message ?? "Created successfully."}</p>
    {state.warnings?.map((warning) => <p className="notice warning" key={warning}>{warning}</p>)}
    {state.success.reused && <p>Added to existing contact <Link href={`/contacts/${state.success.contactId}`}>{state.success.contactName}</Link>.</p>}
    <Link className="button-link" href={`/${kind}/${state.success.id}`}>View {({ companies: "company", contacts: "contact", deals: "deal", activities: "activity", leads: "lead", quotations: "quotation", orders: "order", payments: "payment", expenses: "expense" })[kind]}</Link>{" "}
    {kind === "deals" ? <Link href="/leads">Back to leads</Link> : kind === "orders" ? <Link href="/quotations">Back to quotations</Link> : <a href={`/${kind}/new`}>Create another</a>}
  </section>;
  return <form action={submit} className="record-form">
    <div aria-live="polite">
      {state.message && <p role={Object.keys(state.errors).length ? "alert" : "status"} className="notice">{state.message}</p>}
      {state.errors._form && <p className="error" role="alert">{state.errors._form}</p>}
      {state.warnings?.map((warning) => <p className="notice warning" key={warning}>{warning}</p>)}
    </div>
    <div className="form-grid">{fields.map((field) => {
      const id = `${prefix}-${field.name}`;
      const error = state.errors[field.name];
      const describedBy = [field.hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
      const required = field.required || (["lostReason", "lossReason"].includes(field.name) && status === "lost");
      const controlledValue = selectValues?.[field.name] ?? (field.name === "companyId" ? companyValue : undefined);
      const props = { id, name: field.name, required, defaultValue: values[field.name] ?? "", "aria-invalid": Boolean(error), "aria-describedby": describedBy };
      return <div className={field.type === "textarea" ? "field full-width" : "field"} key={field.name}>
        <label htmlFor={id}>{field.label}{required ? " *" : ""}</label>
        {field.type === "textarea" ? <textarea {...props} rows={4} /> : field.type === "select" ?
          <select {...props}
            defaultValue={controlledValue !== undefined ? undefined : props.defaultValue}
            value={controlledValue}
            onChange={(event) => {
              if (field.name === "status" || field.name === "outcome") setStatus(event.target.value);
              if (field.name === "companyId") onCompanyChange?.(event.target.value);
              onSelectChange?.(field.name, event.target.value);
            }}>
            {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select> : <input {...props} type={field.type ?? "text"} inputMode={["budgetRupees", "valueRupees", "amountRupees"].includes(field.name) ? "decimal" : undefined} />}
        {field.hint && <small className="muted" id={`${id}-hint`}>{field.hint}</small>}
        {error && <p className="error" id={`${id}-error`}>{error}</p>}
      </div>;
    })}</div>
    <button type="submit" disabled={pending}>{pending ? "Saving…" : create ? "Create" : "Save changes"}</button>
  </form>;
}

export function DeleteForm({ action, label }: { action: FormAction; label: string }) {
  const [state, submit, pending] = useActionState(action, { errors: {} });
  const id = useId();
  return <details className="delete-panel">
    <summary>Delete {label}</summary>
    <p>This hides the record from normal lists. Related records are retained. Restore is not available in this phase.</p>
    <form action={submit}>
      <label className="confirmation" htmlFor={id}><input type="checkbox" id={id} name="confirm" value="yes" required /> I confirm I want to delete this record.</label>
      {state.errors._form && <p className="error" role="alert">{state.errors._form}</p>}
      <button type="submit" className="danger" disabled={pending}>{pending ? "Deleting…" : "Confirm delete"}</button>
    </form>
  </details>;
}
