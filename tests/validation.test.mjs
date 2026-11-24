import assert from "node:assert/strict";
import { test } from "node:test";
import { LEAD_ENTRY_METHODS, LEAD_SOURCES, LEAD_STATUSES } from "../src/lib/lead-values.ts";
import {
  budgetPaiseSchema, createContactSchema, createLeadSchema, createLeadWithContactSchema, leadDetailsSchema,
  leadListSchema, updateContactSchema, updateLeadSchema,
} from "../src/lib/validation.ts";

test("budgets retain exact bigint values beyond the JS safe integer limit", () => {
  const amount = "9007199254740993";
  assert.equal(budgetPaiseSchema.parse(amount), BigInt(amount));
  assert.equal(budgetPaiseSchema.parse(BigInt(amount)).toString(), amount);
  for (const invalid of [100, 1.5, "1.5", "1e5", "9223372036854775808", "-9223372036854775809"]) {
    assert.equal(budgetPaiseSchema.safeParse(invalid).success, false);
  }
  assert.equal(budgetPaiseSchema.parse("9223372036854775807"), BigInt("9223372036854775807"));
  assert.equal(budgetPaiseSchema.parse("-9223372036854775808"), BigInt("-9223372036854775808"));
});

test("contacts require a real contact method and cannot inject stored normalized values", () => {
  assert.equal(createContactSchema.safeParse({ fullName: "Person", phone: " ", email: "" }).success, false);
  assert.equal(createContactSchema.safeParse({ fullName: "Person", phone: "123" }).success, false);
  assert.equal(createContactSchema.safeParse({ fullName: "Person", email: "not-email" }).success, false);
  assert.equal(createContactSchema.safeParse({ fullName: "Person", instagramHandle: "@prospera" }).success, true);
  assert.equal(createContactSchema.safeParse({ fullName: "Person", email: "p@example.com", emailNormalized: "forged" }).success, false);
  assert.equal(createContactSchema.parse({ fullName: " Person ", email: " A@EXAMPLE.COM " }).email, "a@example.com");
});

test("complete-row validation prevents removal of the last contact method", () => {
  const current = { fullName: "Person", email: "p@example.com" };
  const patch = updateContactSchema.parse({ email: null });
  assert.equal(createContactSchema.safeParse({ ...current, ...patch }).success, false);
});

test("source and status schemas accept exactly the shared value sets", () => {
  for (const source of LEAD_SOURCES) assert.equal(leadDetailsSchema.safeParse({ source }).success, true);
  for (const status of LEAD_STATUSES) {
    assert.equal(leadDetailsSchema.safeParse({ source: "other", status, lostReason: "Reason" }).success, true);
  }
  assert.equal(leadDetailsSchema.safeParse({ source: "unknown" }).success, false);
  assert.equal(leadDetailsSchema.safeParse({ source: "other", status: "unknown" }).success, false);
});

test("lost reasons are required on create and on a merged complete-row update", () => {
  for (const reason of [undefined, null, "", "  "]) {
    assert.equal(leadDetailsSchema.safeParse({ source: "referral", status: "lost", lostReason: reason }).success, false);
  }
  const contactId = "1d79eb24-a7cc-4ce3-90ae-67cb5724b956";
  const current = createLeadSchema.parse({ source: "other", contactId });
  const patch = updateLeadSchema.parse({ status: "lost" });
  assert.equal(createLeadSchema.safeParse({ ...current, ...patch }).success, false);
  assert.equal(createLeadSchema.safeParse({ ...current, ...patch, lostReason: "Budget" }).success, true);
  assert.equal(leadDetailsSchema.safeParse({ source: "other", convertedAt: new Date() }).success, false);
});

test("date-only deadlines must represent a real calendar date", () => {
  for (const date of ["2026-02-29", "2026-02-30", "2026-13-01", "24/11/2026"]) {
    assert.equal(leadDetailsSchema.safeParse({ source: "other", deadline: date }).success, false);
  }
  assert.equal(leadDetailsSchema.safeParse({ source: "other", deadline: "2028-02-29" }).success, true);
});

test("lead entry method defaults to manual independently of source", () => {
  assert.equal(leadDetailsSchema.parse({ source: "meta_ads" }).entryMethod, "manual");
  for (const entryMethod of LEAD_ENTRY_METHODS) {
    assert.equal(leadDetailsSchema.parse({ source: "meta_ads", entryMethod }).entryMethod, entryMethod);
  }
  assert.equal(leadDetailsSchema.safeParse({ source: "meta_ads", entryMethod: "import" }).success, false);
  assert.equal(updateLeadSchema.safeParse({ entryMethod: "import" }).success, false);
});

test("enquiries take plain input with integration attribution fields, never a session", () => {
  const input = {
    contact: { fullName: "Prospect", email: "p@example.com" },
    lead: { source: "meta_ads", entryMethod: "integration", sourceDetail: "  Campaign / Ad / Form  " },
  };
  const parsed = createLeadWithContactSchema.parse(input);
  assert.equal(parsed.lead.sourceDetail, "Campaign / Ad / Form");
  assert.equal(parsed.lead.entryMethod, "integration");
  assert.equal(createLeadWithContactSchema.safeParse({ ...input, session: {} }).success, false);
  assert.equal(leadDetailsSchema.parse({ source: "website", sourceDetail: "  " }).sourceDetail, null);
});

test("partial lead edits retain entry metadata when omitted", () => {
  const current = createLeadSchema.parse({
    contactId: "1d79eb24-a7cc-4ce3-90ae-67cb5724b956", source: "meta_ads",
    entryMethod: "integration", sourceDetail: "Campaign A",
  });
  const patch = updateLeadSchema.parse({ notes: "Follow up" });
  const merged = createLeadSchema.parse({ ...current, ...patch });
  assert.equal(merged.entryMethod, "integration");
  assert.equal(merged.sourceDetail, "Campaign A");
  assert.equal(updateLeadSchema.parse({ sourceDetail: null }).sourceDetail, null);
});

test("pagination is bounded and mutation updates cannot be effectively empty", () => {
  assert.equal(leadListSchema.parse({}).pageSize, 25);
  for (const input of [{ page: 0 }, { pageSize: 101 }, { page: 1.5 }, { status: "unknown" }]) {
    assert.equal(leadListSchema.safeParse(input).success, false);
  }
  assert.equal(updateContactSchema.safeParse({}).success, false);
  assert.equal(updateContactSchema.safeParse({ email: undefined }).success, false);
  assert.equal(updateLeadSchema.safeParse({ status: undefined }).success, false);
});
