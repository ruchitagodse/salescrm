import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { financeReady, getExpense, getOrder, getPayment, getQuotation, listDeals, listExpenses, listOrders, listPayments, listQuotations } from "@/lib/data";
import { entityIdSchema } from "@/lib/validation";
import { QUOTATION_STATUSES, canChangeQuotation } from "@/lib/finance-values";
import { formatINR, paiseToRupees } from "@/lib/money";
import { indiaLocalInput } from "@/lib/activity-time";
import { fieldValues, optionalRecord } from "./queries";
import { RecordForm } from "./form";
import { FinanceCommand, QuotationForm } from "./finance-forms";
import { quoteCommandAction, recordMoneyAction, saveQuoteAction, voidMoneyAction } from "./finance-actions";
import { DateLabel, LoadingRecords, PageHeading, Pagination, SearchForm, listQuery } from "./ui";
import type { DetailParams, Field, Option, SearchParams } from "./types";

type Kind = "quotations" | "orders" | "payments" | "expenses";
const titles = { quotations: "Quotations", orders: "Orders", payments: "Payments", expenses: "Expenses" };
const Unavailable = () => <section className="panel"><h1>Commercial records unavailable</h1><p>Contact the owner to finish setup.</p></section>;
async function options(kind: "deals" | "orders"): Promise<Option[]> {
  const load = async (page: number) => kind === "deals" ? (await listDeals({ page, pageSize: 100 })).items.map((row) => ({ value: row.id, label: row.title })) : (await listOrders({ page, pageSize: 100 })).items.map((row) => ({ value: row.id, label: `${row.reference}: ${row.title}` }));
  const rows: Option[] = [];
  for (let page = 1; ; page++) { const next = await load(page); rows.push(...next); if (next.length < 100) break; }
  return rows;
}
function ItemTable({ items }: { items: { id: string; description: string; quantity: number; unitPricePaise: string; lineTotalPaise: string }[] }) {
  return <div className="table-scroll" role="region" aria-label="Line items" tabIndex={0}><table><caption className="sr-only">Commercial line items</caption><thead><tr><th scope="col">Description</th><th scope="col">Qty</th><th scope="col" className="money">Unit price</th><th scope="col" className="money">Line total</th></tr></thead>
    <tbody>{items.map((item) => <tr key={item.id}><td>{item.description}</td><td>{item.quantity}</td><td className="money">{formatINR(item.unitPricePaise)}</td><td className="money">{formatINR(item.lineTotalPaise)}</td></tr>)}</tbody></table></div>;
}
async function list(kind: Kind, input: { page: number; search: string }) {
  if (kind === "quotations") { const result = await listQuotations(input); return { ...result, items: result.items.map((r) => ({ id: r.id, label: r.reference, detail: r.title, status: r.status, amount: r.totalPaise, createdAt: r.createdAt })) }; }
  if (kind === "orders") { const result = await listOrders(input); return { ...result, items: result.items.map((r) => ({ id: r.id, label: r.reference, detail: `${r.title} · ${r.customerName}`, status: "snapshot", amount: r.totalPaise, createdAt: r.createdAt })) }; }
  if (kind === "payments") { const result = await listPayments(input); return { ...result, items: result.items.map((r) => ({ id: r.id, label: r.reference || "Payment receipt", detail: `${r.orderReference} · ${r.paidOn} · ${r.method || "Manual"}`, status: r.status, amount: r.amountPaise, createdAt: r.createdAt })) }; }
  const result = await listExpenses(input); return { ...result, items: result.items.map((r) => ({ id: r.id, label: r.payee, detail: `${r.spentOn} · ${r.category}`, status: r.status, amount: r.amountPaise, createdAt: r.createdAt })) };
}
async function FinanceList({ kind, searchParams }: { kind: Kind; searchParams: SearchParams }) {
  await requireUser(); if (!(await financeReady())) return <Unavailable />;
  const { page, search } = await listQuery(searchParams);
  const result = await list(kind, { page, search });
  return <><PageHeading title={titles[kind]} /><section className="panel"><p>{kind === "orders" ? <Link href="/quotations">Convert an accepted quotation to create an order</Link> : <Link className="button-link" href={`/${kind}/new`}>Add {kind === "quotations" ? "quotation" : kind === "payments" ? "payment" : "expense"}</Link>}</p>
    <SearchForm search={search} />{result.items.length ? <div className="table-scroll" role="region" aria-label={titles[kind]} tabIndex={0}><table><caption className="sr-only">{titles[kind]}</caption><thead><tr><th scope="col">Record</th><th scope="col">Details</th><th scope="col">Status</th><th scope="col" className="money">Amount</th><th scope="col">Created</th></tr></thead><tbody>
      {result.items.map((row) => <tr key={row.id}><td><Link href={`/${kind}/${row.id}`}>{row.label}</Link></td><td>{row.detail}</td><td><span className={`badge ${row.status}`}>{row.status}</span></td><td className="money">{formatINR(row.amount)}</td><td><DateLabel value={row.createdAt} /></td></tr>)}
    </tbody></table></div> : <p className="empty-state">No matching records.</p>}<Pagination base={`/${kind}`} {...result} filters={{ search }} /></section></>;
}
async function QuoteNew({ searchParams }: { searchParams: SearchParams }) {
  await requireUser(); if (!(await financeReady())) return <Unavailable />;
  const query = await searchParams, choices = await options("deals");
  const dealId = typeof query.dealId === "string" && choices.some((c) => c.value === query.dealId) ? query.dealId : "";
  return <><PageHeading title="New quotation" /><section className="panel"><Link href="/quotations">Back to quotations</Link><QuotationForm action={saveQuoteAction.bind(null, null)} deals={choices} values={{ dealId }} /></section></>;
}
async function QuoteDetail({ params }: { params: DetailParams }) {
  await requireUser(); if (!(await financeReady())) return <Unavailable />;
  const { id } = await params; if (!entityIdSchema.safeParse(id).success) notFound();
  const quote = await optionalRecord(() => getQuotation(id)); if (!quote) notFound();
  const choices = quote.status === "draft" ? await options("deals") : [];
  if (quote.status === "draft" && !choices.some((c) => c.value === quote.dealId)) choices.push({ value: quote.dealId, label: "Linked deal (unavailable)" });
  return <><PageHeading title={`${quote.reference} · ${quote.title}`} /><section className="panel"><Link href="/quotations">Back to quotations</Link><p><Link href={`/deals/${quote.dealId}`}>Linked deal</Link> · <span className="badge">{quote.status}</span></p>
    <ItemTable items={quote.items} /><p><strong>Total: {formatINR(quote.totalPaise)}</strong></p><p className="muted">No GST or discounts. Sent is a manual status; this app does not send the document.</p>
    {quote.notes && <p>Notes: {quote.notes}</p>}
    {quote.status === "draft" && <QuotationForm action={saveQuoteAction.bind(null, id)} deals={choices} values={fieldValues(quote)} initialLines={quote.items.map((item) => ({ description: item.description, quantity: String(item.quantity), unitPriceRupees: paiseToRupees(item.unitPricePaise) }))} />}
    <div className="finance-actions">{QUOTATION_STATUSES.filter((status) => canChangeQuotation(quote.status, status)).map((status) => <FinanceCommand key={status} action={quoteCommandAction.bind(null, id, status)} label={`Mark ${status}`} />)}</div>
    {quote.orderId ? <p><Link href={`/orders/${quote.orderId}`}>View order snapshot</Link></p> : quote.status === "accepted" && <FinanceCommand action={quoteCommandAction.bind(null, id, "convert")} label="Create immutable order" confirm />}
    {quote.status === "draft" && <details className="delete-panel"><summary>Delete draft</summary><FinanceCommand action={quoteCommandAction.bind(null, id, "delete")} label="Confirm draft deletion" confirm /></details>}
  </section></>;
}
async function OrderDetail({ params }: { params: DetailParams }) {
  await requireUser(); if (!(await financeReady())) return <Unavailable />;
  const { id } = await params; if (!entityIdSchema.safeParse(id).success) notFound();
  const order = await optionalRecord(() => getOrder(id)); if (!order) notFound();
  return <><PageHeading title={`${order.reference} · ${order.title}`} /><section className="panel"><Link href="/orders">Back to orders</Link><p>Customer: {order.customerName} · <Link href={`/quotations/${order.quotationId}`}>Source quotation</Link></p>
    <ItemTable items={order.items} /><p><strong>Total {formatINR(order.totalPaise)} · Received {formatINR(order.paidPaise)} · Balance {formatINR(order.balancePaise)}</strong></p><p>Status: {order.paymentState}</p>
    {order.notes && <p>Notes: {order.notes}</p>}
    {BigInt(order.balancePaise) > BigInt(0) && <Link className="button-link" href={`/payments/new?orderId=${id}`}>Record payment</Link>}
    <h2>Receipts</h2>{order.payments.length ? <ul>{order.payments.map((p) => <li key={p.id}><Link href={`/payments/${p.id}`}>{p.paidOn} · {formatINR(p.amountPaise)}</Link> — {p.status}</li>)}</ul> : <p>No payments recorded.</p>}
    <p className="muted">Order prices and items are frozen. Voided receipts remain in history but do not count toward the balance.</p>
  </section></>;
}
async function MoneyNew({ kind, searchParams }: { kind: "payments" | "expenses"; searchParams: SearchParams }) {
  await requireUser(); if (!(await financeReady())) return <Unavailable />;
  const today = indiaLocalInput(new Date()).slice(0, 10), query = await searchParams;
  const choices = kind === "payments" ? await options("orders") : [];
  const fields: Field[] = kind === "payments" ? [
    { name: "orderId", label: "Order", type: "select", required: true, options: [{ value: "", label: "Select order" }, ...choices] },
    { name: "paidOn", label: "Payment date", type: "date", required: true }, { name: "amountRupees", label: "Amount received (₹)", required: true, hint: "Positive amount, at most two decimals. Overpayments are rejected." },
    { name: "method", label: "Method" }, { name: "reference", label: "Reference" }, { name: "notes", label: "Notes", type: "textarea" },
  ] : [{ name: "spentOn", label: "Expense date", type: "date", required: true }, { name: "payee", label: "Payee", required: true }, { name: "category", label: "Category", required: true }, { name: "amountRupees", label: "Amount (₹)", required: true }, { name: "notes", label: "Notes", type: "textarea" }];
  const orderId = typeof query.orderId === "string" && choices.some((c) => c.value === query.orderId) ? query.orderId : "";
  return <><PageHeading title={kind === "payments" ? "Record payment" : "Record expense"} /><section className="panel"><Link href={`/${kind}`}>Back to {kind}</Link><p className="muted">Record manually. This does not charge, transfer or refund money. Correct a recorded entry by voiding it with a reason.</p>
    <RecordForm action={recordMoneyAction.bind(null, kind)} fields={fields} kind={kind} create values={{ orderId, paidOn: today, spentOn: today }} />
  </section></>;
}
async function MoneyDetail({ kind, params }: { kind: "payments" | "expenses"; params: DetailParams }) {
  await requireUser(); if (!(await financeReady())) return <Unavailable />;
  const { id } = await params; if (!entityIdSchema.safeParse(id).success) notFound();
  if (kind === "payments") {
    const row = await optionalRecord(() => getPayment(id)); if (!row) notFound();
    return <><PageHeading title="Payment receipt" /><section className="panel"><Link href="/payments">Back to payments</Link><p><Link href={`/orders/${row.orderId}`}>View order and balance</Link></p><p>{formatINR(row.amountPaise)} · {row.paidOn} · {row.status}</p><p>Method: {row.method || "—"} · Reference: {row.reference || "—"}</p><p>{row.notes}</p>
      {row.status === "voided" ? <p className="notice">Void reason: {row.voidReason}</p> : <details className="delete-panel"><summary>Void payment</summary><FinanceCommand action={voidMoneyAction.bind(null, kind, id)} label="Void receipt" reason confirm /></details>}
    </section></>;
  }
  const row = await optionalRecord(() => getExpense(id)); if (!row) notFound();
  return <><PageHeading title={row.payee} /><section className="panel"><Link href="/expenses">Back to expenses</Link><p>{formatINR(row.amountPaise)} · {row.spentOn} · {row.category} · {row.status}</p><p>{row.notes}</p>
    {row.status === "voided" ? <p className="notice">Void reason: {row.voidReason}</p> : <details className="delete-panel"><summary>Void expense</summary><FinanceCommand action={voidMoneyAction.bind(null, kind, id)} label="Void expense" reason confirm /></details>}
  </section></>;
}
export function FinancialListPage(props: { kind: Kind; searchParams: SearchParams }) { return <Suspense fallback={<LoadingRecords />}><FinanceList {...props} /></Suspense>; }
export function QuotationNewPage(props: { searchParams: SearchParams }) { return <Suspense fallback={<LoadingRecords />}><QuoteNew {...props} /></Suspense>; }
export function QuotationDetailPage(props: { params: DetailParams }) { return <Suspense fallback={<LoadingRecords />}><QuoteDetail {...props} /></Suspense>; }
export function OrderDetailPage(props: { params: DetailParams }) { return <Suspense fallback={<LoadingRecords />}><OrderDetail {...props} /></Suspense>; }
export function MoneyNewPage(props: { kind: "payments" | "expenses"; searchParams: SearchParams }) { return <Suspense fallback={<LoadingRecords />}><MoneyNew {...props} /></Suspense>; }
export function MoneyDetailPage(props: { kind: "payments" | "expenses"; params: DetailParams }) { return <Suspense fallback={<LoadingRecords />}><MoneyDetail {...props} /></Suspense>; }
