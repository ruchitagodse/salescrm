import { z } from "zod";
import { indiaLocalInput } from "./activity-time.ts";
const DAY_MS = 24 * 60 * 60 * 1000;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const dates = z.object({ start: day.optional(), end: day.optional() }).strict()
  .refine((value) => Boolean(value.start) === Boolean(value.end));
export type AnalyticsRange = { start: string; end: string; startInstant: string; endExclusive: string; months: string[] };
export function analyticsRange(input: unknown, now: Date): AnalyticsRange {
  const result = dates.safeParse(input);
  if (!result.success) throw new RangeError("Choose two valid calendar dates.");
  const today = indiaLocalInput(now).slice(0, 10);
  const start = result.data.start ?? `${today.slice(0, 7)}-01`;
  const end = result.data.end ?? today;
  const startTime = new Date(`${start}T00:00:00+05:30`);
  const endTime = new Date(`${end}T00:00:00+05:30`);
  if (startTime > endTime || endTime.getTime() - startTime.getTime() > 3660 * DAY_MS) throw new RangeError("Choose an ordered range of no more than 3,660 days.");
  const months: string[] = [];
  let year = Number(start.slice(0, 4)), month = Number(start.slice(5, 7));
  const last = end.slice(0, 7);
  for (;;) {
    const value = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
    months.push(value); if (value === last) break;
    month++; if (month > 12) { month = 1; year++; }
  }
  return { start, end, startInstant: startTime.toISOString(), endExclusive: new Date(endTime.getTime() + DAY_MS).toISOString(), months };
}
export function exactRate(numerator: string, denominator: string): string {
  const n = BigInt(numerator), d = BigInt(denominator);
  if (n < BigInt(0) || d < BigInt(0) || n > d) throw new RangeError("Invalid cohort counts");
  if (d === BigInt(0)) return "—";
  const hundredths = (n * BigInt(10000) + d / BigInt(2)) / d;
  return `${hundredths / BigInt(100)}.${(hundredths % BigInt(100)).toString().padStart(2, "0")}%`;
}
// Dimensionless plot coordinates only. Monetary amounts never become Numbers.
export function normalizedCoordinates(values: readonly string[]): number[] {
  const integers = values.map((value) => BigInt(value));
  if (integers.some((v) => v < BigInt(0))) throw new RangeError("Negative chart magnitude");
  const max = integers.reduce((largest, value) => value > largest ? value : largest, BigInt(0));
  return integers.map((value) => max === BigInt(0) ? 0 : Number(value * BigInt(10000) / max));
}
export function cashSeries(months: readonly string[], rows: readonly { month: string; receipts: string; expenses: string }[]) {
  const map = new Map(rows.map((row) => [row.month, row]));
  return months.map((month) => {
    const row = map.get(month) ?? { month, receipts: "0", expenses: "0" };
    return { ...row, netCash: (BigInt(row.receipts) - BigInt(row.expenses)).toString() };
  });
}
export function formatCount(value: string) { return new Intl.NumberFormat("en-IN").format(BigInt(value)); }
