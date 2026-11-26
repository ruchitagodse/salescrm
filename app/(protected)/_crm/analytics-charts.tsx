"use client";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, BarChart, Bar } from "recharts";
import { normalizedCoordinates, formatCount } from "@/lib/analytics-values";
import { formatINR } from "@/lib/money";
import type { CashMonth } from "@/lib/analytics-types";

export function CashChart({ rows }: { rows: CashMonth[] }) {
  const coordinates = normalizedCoordinates(rows.flatMap(r => [r.receipts, r.expenses]));
  const data = rows.map((r, i) => ({ ...r, receiptRatio: coordinates[i * 2], expenseRatio: coordinates[i * 2 + 1] }));
  if (rows.every(r => r.receipts === "0" && r.expenses === "0")) return <p>No recorded cash movements in this period.</p>;
  return <div className="analytics-chart" role="img" aria-label="Monthly receipts and expenses; exact amounts in the following table.">
    <ResponsiveContainer width="100%" height={280}><LineChart data={data} accessibilityLayer>
      <XAxis dataKey="month" /><YAxis hide domain={[0, 10000]} />
      <Tooltip content={({ active, payload }) => {
        const row = payload?.[0]?.payload as CashMonth | undefined;
        return active && row ? <div className="panel">{row.month}<p>Receipts: {formatINR(row.receipts)}</p><p>Expenses: {formatINR(row.expenses)}</p></div> : null;
      }} /><Legend />
      <Line name="Receipts" dataKey="receiptRatio" stroke="#187b52" strokeWidth={3} isAnimationActive={false} />
      <Line name="Expenses" dataKey="expenseRatio" stroke="#b34a27" strokeWidth={3} isAnimationActive={false} />
    </LineChart></ResponsiveContainer>
  </div>;
}
export function SourceChart({ rows }: { rows: { key: string; count: string }[] }) {
  const ratios = normalizedCoordinates(rows.map(r => r.count));
  const data = rows.map((r, i) => ({ ...r, ratio: ratios[i] }));
  if (!rows.length) return <p>No leads created in this period.</p>;
  return <div className="analytics-chart" role="img" aria-label="Lead sources; exact counts in the following table.">
    <ResponsiveContainer width="100%" height={280}><BarChart data={data} accessibilityLayer>
      <XAxis dataKey="key" /><YAxis hide domain={[0, 10000]} />
      <Tooltip content={({ active, payload }) => {
        const row = payload?.[0]?.payload as { key: string; count: string } | undefined;
        return active && row ? <div className="panel">{row.key}: {formatCount(row.count)}</div> : null;
      }} /><Bar dataKey="ratio" name="Leads" fill="#315b93" isAnimationActive={false} />
    </BarChart></ResponsiveContainer>
  </div>;
}
