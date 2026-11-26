import type { ActivityView } from "./activity-values.ts";

const INDIA_OFFSET_MS = 330 * 60 * 1000;
export function indiaLocalInput(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date/time");
  return new Date(date.getTime() + INDIA_OFFSET_MS).toISOString().slice(0, 16);
}
export function parseIndiaDateTime(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new RangeError("Enter an India date and time.");
  const date = new Date(`${value}:00+05:30`);
  if (Number.isNaN(date.getTime()) || indiaLocalInput(date) !== value) throw new RangeError("Invalid calendar date/time.");
  return date;
}
export function activityWindow(view: ActivityView, now: Date): { status?: "planned" | "completed"; from?: Date; before?: Date } {
  const day = indiaLocalInput(now).slice(0, 10);
  const start = new Date(`${day}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  if (view === "today") return { status: "planned", from: start, before: end };
  if (view === "upcoming") return { status: "planned", from: end };
  if (view === "overdue") return { status: "planned", before: now };
  if (view === "completed") return { status: "completed" };
  return {};
}
