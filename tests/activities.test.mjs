import assert from "node:assert/strict";
import { test } from "node:test";
import { activityTarget, activityTargetColumns, completionTime, ACTIVITY_STATUSES, ACTIVITY_TARGETS, ACTIVITY_TYPES } from "../src/lib/activity-values.ts";
import { activityWindow, indiaLocalInput, parseIndiaDateTime } from "../src/lib/activity-time.ts";
import { activityListSchema, createActivitySchema, updateActivitySchema } from "../src/lib/activity-validation.ts";

const id = "1d79eb24-a7cc-4ce3-90ae-67cb5724b956";
const input = { title: " Follow up ", type: "follow_up", dueAt: "2026-11-25T04:00:00Z", targetType: "lead", targetId: id };

test("India datetime-local input round trips independently of machine timezone", () => {
  const instant = parseIndiaDateTime("2026-11-25T09:30");
  assert.equal(instant.toISOString(), "2026-11-25T04:00:00.000Z");
  assert.equal(indiaLocalInput(instant), "2026-11-25T09:30");
  assert.equal(parseIndiaDateTime("2026-12-31T23:59").toISOString(), "2026-12-31T18:29:00.000Z");
  assert.equal(indiaLocalInput("2026-12-31T20:00:00Z"), "2027-01-01T01:30");
});
test("invalid local dates, times, missing values and seconds are rejected", () => {
  for (const value of ["", "tomorrow", "2026-02-29T09:00", "2026-02-30T09:00", "2026-11-25T24:00", "2026-11-25T09:60", "2026-11-25T09:30:00"]) {
    assert.throws(() => parseIndiaDateTime(value), RangeError);
  }
  assert.equal(parseIndiaDateTime("2028-02-29T00:00").toISOString(), "2028-02-28T18:30:00.000Z");
});
test("Today and Upcoming use exact India midnight boundaries, including year rollover", () => {
  const beforeMidnight = new Date("2026-11-25T18:29:59Z");
  const today = activityWindow("today", beforeMidnight);
  assert.equal(today.status, "planned");
  assert.equal(today.from.toISOString(), "2026-11-24T18:30:00.000Z");
  assert.equal(today.before.toISOString(), "2026-11-25T18:30:00.000Z");
  assert.equal(activityWindow("upcoming", beforeMidnight).from.getTime(), today.before.getTime());
  assert.equal(activityWindow("today", new Date("2026-11-25T18:30:00Z")).from.toISOString(), "2026-11-25T18:30:00.000Z");
  assert.equal(activityWindow("today", new Date("2026-12-31T18:30:00Z")).before.toISOString(), "2027-01-01T18:30:00.000Z");
});
test("Overdue only includes planned work strictly before now; Completed is a status view", () => {
  const now = new Date("2026-11-25T04:00:00Z");
  assert.deepEqual(activityWindow("overdue", now), { status: "planned", before: now });
  assert.deepEqual(activityWindow("completed", now), { status: "completed" });
  assert.deepEqual(activityWindow("all", now), {});
});
test("exactly one primary target is preserved and other FKs are cleared on reassignment", () => {
  for (const type of ACTIVITY_TARGETS) {
    const row = activityTargetColumns(type, id);
    assert.equal(Object.values(row).filter(Boolean).length, 1);
    assert.deepEqual(activityTarget(row), { targetType: type, targetId: id });
  }
  assert.throws(() => activityTarget({ contactId: null, leadId: null, dealId: null }), RangeError);
  assert.throws(() => activityTarget({ contactId: id, leadId: id, dealId: null }), RangeError);
});
test("completion timestamps are server transitions, not client supplied history", () => {
  const before = new Date("2026-11-24T04:00:00Z");
  const now = new Date("2026-11-25T04:00:00Z");
  assert.equal(completionTime(null, null, "planned", now), null);
  assert.equal(completionTime("planned", null, "completed", now), now);
  assert.equal(completionTime("completed", before, "completed", now), before);
  assert.equal(completionTime("completed", null, "completed", now), now);
  assert.equal(completionTime("completed", before, "planned", now), null);
  assert.equal(completionTime("completed", before, "cancelled", now), null);
  assert.equal(completionTime("cancelled", null, "completed", now), now);
});
test("shared schemas accept exactly the approved types, statuses and valid targets", () => {
  const parsed = createActivitySchema.parse(input);
  assert.equal(parsed.title, "Follow up");
  assert.equal(parsed.status, "planned");
  assert.equal(parsed.dueAt.toISOString(), "2026-11-25T04:00:00.000Z");
  for (const type of ACTIVITY_TYPES) for (const status of ACTIVITY_STATUSES) {
    assert.equal(createActivitySchema.safeParse({ ...input, type, status }).success, true);
  }
  for (const extra of [{ completedAt: new Date() }, { deletedAt: null }, { contactId: id }, { assigneeId: id }]) {
    assert.equal(createActivitySchema.safeParse({ ...input, ...extra }).success, false);
  }
  for (const patch of [{ targetId: "not-uuid" }, { targetType: "company" }, { type: "email" }, { status: "done" }, { dueAt: "2026-11-25T09:30" }, { dueAt: new Date("invalid") }]) {
    assert.equal(createActivitySchema.safeParse({ ...input, ...patch }).success, false);
  }
});
test("partial target updates and unbounded/ambiguous list queries are rejected", () => {
  assert.equal(updateActivitySchema.safeParse({ status: "completed" }).success, true);
  assert.equal(updateActivitySchema.safeParse({ targetType: "deal" }).success, false);
  assert.equal(updateActivitySchema.safeParse({ targetId: id }).success, false);
  assert.equal(updateActivitySchema.safeParse({ targetType: "deal", targetId: id }).success, true);
  assert.equal(updateActivitySchema.safeParse({ title: undefined }).success, false);
  assert.equal(activityListSchema.safeParse({ targetType: "contact" }).success, false);
  assert.equal(activityListSchema.safeParse({ targetType: "contact", targetId: id }).success, true);
  for (const query of [{ page: 0 }, { pageSize: 101 }, { view: "tomorrow" }, { search: "a".repeat(501) }]) assert.equal(activityListSchema.safeParse(query).success, false);
});
