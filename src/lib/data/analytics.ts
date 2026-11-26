import "server-only";
import { analyticsRange, cashSeries, exactRate } from "@/lib/analytics-values";
import { analyticsQuery } from "@/lib/analytics-query";
import type { AnalyticsRaw } from "@/lib/analytics-types";
import { DataError, withData } from "./shared";

// Plain input; the protected caller authenticates before any report query.
export async function getAnalytics(input: unknown = {}) {
  return withData(async (db) => {
    let range;
    try { range = analyticsRange(input, new Date()); } catch { throw new DataError("INVALID_INPUT"); }
    return db.transaction(async (tx) => {
      const [row] = await tx.execute<{ report: AnalyticsRaw }>(analyticsQuery(range));
      const report = row.report;
      return { ...report, range, netCash: (BigInt(report.receipts) - BigInt(report.expenses)).toString(),
        conversionRate: exactRate(report.convertedCount, report.leadCount), monthly: cashSeries(range.months, report.monthly) };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  });
}
