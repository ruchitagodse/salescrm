import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contactFillPatch, ContactMatchConflict, convertedAtForStatus, selectContactMatch,
} from "../src/lib/contact-merge.ts";

test("no match creates a contact; a phone or email match reuses the contact", () => {
  assert.equal(selectContactMatch([]), null);
  assert.equal(selectContactMatch([{ id: "contact-a" }]), "contact-a");
  assert.equal(selectContactMatch([{ id: "contact-a" }, { id: "contact-a" }]), "contact-a");
});

test("split matches never silently choose or merge two existing contacts", () => {
  assert.throws(() => selectContactMatch([{ id: "phone-owner" }, { id: "email-owner" }]), ContactMatchConflict);
});

test("enquiries fill empty contact fields without overwriting known data", () => {
  const existing = { fullName: "Existing name", email: "known@example.com", phone: null, city: " ", companyId: "existing-company", notes: "Keep these notes" };
  const incoming = { fullName: "Different name", email: "other@example.com", phone: "+919876543210", city: "Mumbai", companyId: "different-company", notes: "New notes" };
  assert.deepEqual(contactFillPatch(existing, incoming), { phone: "+919876543210", city: "Mumbai" });
  assert.equal(existing.phone, null, "the decision helper must not mutate its inputs");
});

test("empty incoming fields do not erase existing values or generate empty patches", () => {
  assert.deepEqual(contactFillPatch({ fullName: "Person", phone: null }, { fullName: "Person", phone: "", city: null }), {});
});

test("a new converted lead gets a timestamp; editing it preserves the timestamp", () => {
  const now = new Date("2026-11-24T10:00:00Z");
  const before = new Date("2026-11-23T10:00:00Z");
  assert.equal(convertedAtForStatus(null, null, "converted", now), now);
  assert.equal(convertedAtForStatus("qualified", null, "converted", now), now);
  assert.equal(convertedAtForStatus("converted", before, "converted", now), before);
  assert.equal(convertedAtForStatus("converted", before, "lost", now), before);
  assert.equal(convertedAtForStatus("lost", before, "converted", now), now);
  assert.equal(convertedAtForStatus(null, null, "new", now), null);
});
