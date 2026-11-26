"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { saveQuotation, changeQuotationStatus, softDeleteQuotation, convertQuotationToOrder, recordPayment, recordExpense, voidFinancialRecord } from "@/lib/data";
import { entityIdSchema } from "@/lib/validation";
import { expenseInputSchema, paymentInputSchema, quotationInputSchema, voidInputSchema } from "@/lib/finance-validation";
import { rupeesToPaise } from "@/lib/money";
import { calculateItems } from "@/lib/finance-values";
import { failure, formValues, invalidForm, refreshRecords } from "./action-helpers";
import type { FormState } from "./types";

export async function saveQuoteAction(id: string | null, _previous: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  if (id !== null && !entityIdSchema.safeParse(id).success) return { errors: { _form: "Invalid quotation." } };
  const descriptions = data.getAll("description"), quantities = data.getAll("quantity"), prices = data.getAll("unitPriceRupees");
  if (!descriptions.length || descriptions.length > 100 || quantities.length !== descriptions.length || prices.length !== descriptions.length) return { errors: { _form: "Provide 1–100 complete line items." } };
  const items = [];
  for (let index = 0; index < descriptions.length; index++) {
    let amount;
    try { amount = typeof prices[index] === "string" ? rupeesToPaise(prices[index] as string) : null; } catch { amount = null; }
    if (amount === null) return { errors: { [`items.${index}.unitPricePaise`]: "Enter non-negative rupees with at most two decimal places." } };
    items.push({ description: descriptions[index], quantity: quantities[index], unitPricePaise: amount });
  }
  const parsed = quotationInputSchema.safeParse({ ...formValues(data, ["title", "dealId", "notes"]), items });
  if (!parsed.success) return invalidForm(parsed.error.issues);
  try { calculateItems(parsed.data.items); } catch { return { errors: { _form: "Quotation total exceeds the supported range." } }; }
  try {
    const quote = await saveQuotation(id, parsed.data); refreshRecords();
    return { errors: {}, message: "Quotation saved.", success: { id: quote.id, label: quote.reference, kind: "quotations" } };
  } catch (error) { return failure(error); }
}
export async function quoteCommandAction(id: string, command: string, _previous: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  if (!entityIdSchema.safeParse(id).success) return { errors: { _form: "Invalid quotation." } };
  try {
    if (command === "convert") {
      if (data.get("confirm") !== "yes") return { errors: { _form: "Confirm order creation." } };
      const order = await convertQuotationToOrder(id); refreshRecords();
      return { errors: {}, message: "Order snapshot is ready.", success: { id: order.id, label: order.reference, kind: "orders" } };
    }
    if (command === "delete") {
      if (data.get("confirm") !== "yes") return { errors: { _form: "Confirm deletion." } };
      await softDeleteQuotation(id); refreshRecords();
    } else { await changeQuotationStatus(id, command); refreshRecords(); return { errors: {}, message: "Quotation status updated." }; }
  } catch (error) { return failure(error); }
  redirect("/quotations");
}
export async function recordMoneyAction(kind: "payments" | "expenses", _previous: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  if (kind !== "payments" && kind !== "expenses") return { errors: { _form: "Invalid record type." } };
  let amountPaise;
  try { amountPaise = rupeesToPaise(String(data.get("amountRupees") ?? "")); } catch { amountPaise = null; }
  if (amountPaise === null || amountPaise <= BigInt(0)) return { errors: { amountRupees: "Enter positive rupees with at most two decimal places." } };
  try {
    if (kind === "payments") {
      const parsed = paymentInputSchema.safeParse({ ...formValues(data, ["orderId", "paidOn", "method", "reference", "notes"]), amountPaise });
      if (!parsed.success) return invalidForm(parsed.error.issues);
      const row = await recordPayment(parsed.data); refreshRecords();
      return { errors: {}, message: "Payment recorded.", success: { id: row.id, label: "Payment", kind } };
    }
    const parsed = expenseInputSchema.safeParse({ ...formValues(data, ["spentOn", "payee", "category", "notes"]), amountPaise });
    if (!parsed.success) return invalidForm(parsed.error.issues);
    const row = await recordExpense(parsed.data); refreshRecords();
    return { errors: {}, message: "Expense recorded.", success: { id: row.id, label: "Expense", kind } };
  } catch (error) { return failure(error); }
}
export async function voidMoneyAction(kind: "payments" | "expenses", id: string, _previous: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  if (!entityIdSchema.safeParse(id).success || !["payments", "expenses"].includes(kind) || data.get("confirm") !== "yes") return { errors: { _form: "Confirm voiding a valid record." } };
  const parsed = voidInputSchema.safeParse(formValues(data, ["reason"]));
  if (!parsed.success) return invalidForm(parsed.error.issues);
  try { await voidFinancialRecord(kind, id, parsed.data); refreshRecords(); return { errors: {}, message: "Record voided; original amount retained in history." }; }
  catch (error) { return failure(error); }
}
