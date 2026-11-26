"use client";
import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { calculateItems } from "@/lib/finance-values";
import { formatINR, rupeesToPaise } from "@/lib/money";
import type { FormAction, Option } from "./types";

export function FinanceCommand({ action, label, confirm = false, reason = false }: { action: FormAction; label: string; confirm?: boolean; reason?: boolean }) {
  const [state, submit, pending] = useActionState(action, { errors: {} });
  const id = useId();
  return <form action={submit} className="finance-command">
    {reason && <div className="field"><label htmlFor={`${id}-reason`}>Void reason</label><textarea id={`${id}-reason`} name="reason" required rows={2} maxLength={2000} aria-describedby={state.errors.reason ? `${id}-error` : undefined} />{state.errors.reason && <p className="error" id={`${id}-error`}>{state.errors.reason}</p>}</div>}
    {confirm && <label className="confirmation"><input type="checkbox" name="confirm" value="yes" required /> I confirm this action.</label>}
    {state.errors._form && <p className="error" role="alert">{state.errors._form}</p>}
    {state.message && <p role="status">{state.message}</p>}
    {state.success ? <Link className="button-link" href={`/${state.success.kind}/${state.success.id}`}>View {state.success.label}</Link> : <button disabled={pending} type="submit">{pending ? "Saving…" : label}</button>}
  </form>;
}
type Line = { description: string; quantity: string; unitPriceRupees: string };
export function QuotationForm({ action, deals, values = {}, initialLines }: { action: FormAction; deals: Option[]; values?: Record<string, string>; initialLines?: Line[] }) {
  const [state, submit, pending] = useActionState(action, { errors: {} });
  const [lines, setLines] = useState<Line[]>(initialLines ?? [{ description: "", quantity: "1", unitPriceRupees: "" }]);
  const id = useId();
  const update = (index: number, key: keyof Line, value: string) => setLines((rows) => rows.map((row, n) => n === index ? { ...row, [key]: value } : row));
  let total: bigint | null = null;
  try { total = calculateItems(lines.map((line) => {
    const amount = rupeesToPaise(line.unitPriceRupees);
    if (amount === null || !/^\d+$/.test(line.quantity)) throw new RangeError();
    return { description: line.description, quantity: Number(line.quantity), unitPricePaise: amount };
  })).totalPaise; } catch { /* Incomplete preview; authoritative validation is on server. */ }
  if (state.success) return <section className="notice" aria-live="polite"><p>{state.message}</p><Link href={`/quotations/${state.success.id}`}>View {state.success.label}</Link></section>;
  return <form action={submit} className="record-form">
    {state.message && <p role="status">{state.message}</p>}{state.errors._form && <p className="error" role="alert">{state.errors._form}</p>}
    <div className="form-grid">{["title", "dealId", "notes"].map((key) => <div className="field" key={key}>
      <label htmlFor={`${id}-${key}`}>{key === "dealId" ? "Deal" : key === "title" ? "Title" : "Notes"}</label>
      {key === "dealId" ? <select id={`${id}-${key}`} name={key} required defaultValue={values[key] || ""} aria-invalid={Boolean(state.errors[key])} aria-describedby={state.errors[key] ? `${id}-${key}-error` : undefined}><option value="">Select deal</option>{deals.map((deal) => <option key={deal.value} value={deal.value}>{deal.label}</option>)}</select> : key === "notes" ? <textarea id={`${id}-${key}`} name={key} defaultValue={values[key] || ""} /> : <input id={`${id}-${key}`} name={key} required defaultValue={values[key] || ""} aria-invalid={Boolean(state.errors[key])} aria-describedby={state.errors[key] ? `${id}-${key}-error` : undefined} />}
      {state.errors[key] && <p className="error" id={`${id}-${key}-error`}>{state.errors[key]}</p>}
    </div>)}</div>
    <h2>Line items</h2><p className="muted">Whole-number quantities. INR prices only; GST and discounts are not included.</p>
    {lines.map((line, index) => <fieldset className="quote-line" key={index}><legend>Item {index + 1}</legend><div className="form-grid">
      {(["description", "quantity", "unitPriceRupees"] as const).map((key) => {
        const errorKey = `items.${index}.${key === "unitPriceRupees" ? "unitPricePaise" : key}`;
        const inputId = `${id}-${index}-${key}`;
        return <div className="field" key={key}><label htmlFor={inputId}>{key === "unitPriceRupees" ? "Unit price (₹)" : key === "quantity" ? "Quantity" : "Description"}</label>
          <input id={inputId} name={key} required value={line[key]} onChange={(event) => update(index, key, event.target.value)} inputMode={key === "quantity" ? "numeric" : key === "unitPriceRupees" ? "decimal" : undefined}
            aria-invalid={Boolean(state.errors[errorKey])} aria-describedby={state.errors[errorKey] ? `${inputId}-error` : undefined} />
          {state.errors[errorKey] && <p className="error" id={`${inputId}-error`}>{state.errors[errorKey]}</p>}</div>;
      })}</div><button type="button" className="secondary" disabled={lines.length === 1} onClick={() => setLines((rows) => rows.filter((_, n) => n !== index))}>Remove item {index + 1}</button></fieldset>)}
    {state.errors.items && <p className="error">{state.errors.items}</p>}
    <button type="button" className="secondary" disabled={lines.length >= 100} onClick={() => setLines((rows) => [...rows, { description: "", quantity: "1", unitPriceRupees: "" }])}>Add item</button>
    <p><strong>Total: {formatINR(total)}</strong></p><button type="submit" disabled={pending}>{pending ? "Saving…" : "Save draft"}</button>
  </form>;
}
