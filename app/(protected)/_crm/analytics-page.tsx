import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAnalytics } from "@/lib/data/analytics";
import { analyticsRange, formatCount } from "@/lib/analytics-values";
import { formatINR } from "@/lib/money";
import { CashChart, SourceChart } from "./analytics-charts";
import { LoadingRecords, PageHeading } from "./ui";
import type { SearchParams } from "./types";

function RangeForm({ start, end }: { start?: string; end?: string }) {
  return <form method="get" className="list-filters"><div className="field"><label htmlFor="analytics-start">From (India)</label><input id="analytics-start" type="date" name="start" required defaultValue={start} /></div>
    <div className="field"><label htmlFor="analytics-end">Through (inclusive)</label><input id="analytics-end" type="date" name="end" required defaultValue={end} /></div><button>Apply dates</button><Link href="/analytics">Month to date</Link></form>;
}
function Counts({ title, rows }: { title: string; rows: { key: string; count: string }[] }) {
  return <div className="table-wrap"><table><caption>{title}</caption><thead><tr><th scope="col">Group</th><th scope="col">Count</th></tr></thead><tbody>{rows.map(r => <tr key={r.key}><th scope="row">{r.key.replaceAll("_", " ")}</th><td>{formatCount(r.count)}</td></tr>)}{!rows.length && <tr><td colSpan={2}>No records in this cohort.</td></tr>}</tbody></table></div>;
}
async function Analytics({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const params = await searchParams;
  let range;
  try { range = analyticsRange({ ...(params.start === undefined ? {} : { start: params.start }), ...(params.end === undefined ? {} : { end: params.end }) }, new Date()); }
  catch { return <><PageHeading title="Analytics" /><RangeForm /><p role="alert">Choose two valid dates in order, no more than 3,660 days apart.</p></>; }
  const report = await getAnalytics({ start: range.start, end: range.end });
  return <>
    <PageHeading title="Analytics" subtitle="Recorded cash, booking totals and sales cohorts. Dates use India time." />
    <RangeForm start={range.start} end={range.end} />
    <section aria-labelledby="period-heading"><h2 id="period-heading">Selected period: {range.start} to {range.end}</h2>
      <p className="muted">Both dates included. Voided and deleted records are excluded. Net cash is receipts minus expenses; it is not profit or accrual revenue.</p>
      <dl className="analytics-metrics">{[
        ["Cash receipts", formatINR(report.receipts), `${formatCount(report.receiptCount)} receipts by paid date`],
        ["Expenses", formatINR(report.expenses), `${formatCount(report.expenseCount)} expenses by spent date`],
        ["Net cash", formatINR(report.netCash), "Receipts minus expenses"],
        ["Booked order value", formatINR(report.bookedValue), `${formatCount(report.orderCount)} orders created`],
        ["Leads created", formatCount(report.leadCount), "Non-deleted lead cohort"],
        ["Lead-to-deal conversion", report.conversionRate, `${formatCount(report.convertedCount)} of ${formatCount(report.leadCount)} leads have a live deal`],
      ].map(([label, value, hint]) => <div className="panel" key={label}><dt>{label}</dt><dd>{value}</dd><small>{hint}</small></div>)}</dl>
      <h3>Monthly cash movement</h3><CashChart rows={report.monthly} />
      <div className="table-wrap"><table><caption>Exact monthly amounts (INR)</caption><thead><tr><th scope="col">Month</th><th scope="col">Receipts</th><th scope="col">Expenses</th><th scope="col">Net cash</th></tr></thead><tbody>{report.monthly.map(r => <tr key={r.month}><th scope="row">{r.month}</th><td>{formatINR(r.receipts)}</td><td>{formatINR(r.expenses)}</td><td>{formatINR(r.netCash)}</td></tr>)}</tbody></table></div>
      <h3>Lead sources</h3><SourceChart rows={report.sources} /><Counts title="Sources of leads created in range" rows={report.sources} />
      <Counts title="Current statuses of leads created in range" rows={report.leadStatuses} />
      <p>Conversion counts a linked live deal even if created outside the selected period.</p>
      <h3>Deals created in range: {formatCount(report.dealCount)}</h3><p className="muted">Current stage and outcome of this cohort; these are not dates of stage changes or wins.</p>
      <Counts title="Deal cohort: current stages" rows={report.dealStages} /><Counts title="Deal cohort: current outcomes" rows={report.dealOutcomes} />
    </section>
    <section aria-labelledby="snapshot-heading"><h2 id="snapshot-heading">Current snapshots · all dates</h2><p className="muted">Unaffected by the date filter. Snapshot: {new Date(report.asOf).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} India time.</p>
      <dl className="analytics-metrics"><div className="panel"><dt>Outstanding balance</dt><dd>{formatINR(report.outstanding)}</dd><small>{formatCount(report.outstandingOrders)} orders with a balance</small></div><div className="panel"><dt>Open pipeline · known value</dt><dd>{formatINR(report.openPipeline)}</dd><small>{formatCount(report.openDeals)} open deals; {formatCount(report.unknownValues)} have no value</small></div></dl>
      <div className="table-wrap"><table><caption>Current open pipeline by stage</caption><thead><tr><th scope="col">Stage</th><th scope="col">Deals</th><th scope="col">Known value</th><th scope="col">Unvalued deals</th></tr></thead><tbody>{report.pipeline.map(r => <tr key={r.key}><th scope="row">{r.key}</th><td>{formatCount(r.count)}</td><td>{formatINR(r.value)}</td><td>{formatCount(r.unknown)}</td></tr>)}{!report.pipeline.length && <tr><td colSpan={4}>No open deals.</td></tr>}</tbody></table></div>
      <div className="table-wrap"><table><caption>Up to 10 oldest orders with a current balance</caption><thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Total</th><th scope="col">Paid</th><th scope="col">Balance</th></tr></thead><tbody>{report.balances.map(r => <tr key={r.id}><th scope="row"><Link href={`/orders/${r.id}`}>O-{r.number.padStart(6, "0")} · {r.title}</Link></th><td>{r.customerName}</td><td>{formatINR(r.total)}</td><td>{formatINR(r.paid)}</td><td>{formatINR(r.balance)}</td></tr>)}{!report.balances.length && <tr><td colSpan={5}>No outstanding orders.</td></tr>}</tbody></table></div>
    </section>
  </>;
}
export default function AnalyticsPage(props: { searchParams: SearchParams }) { return <Suspense fallback={<LoadingRecords />}><Analytics {...props} /></Suspense>; }
