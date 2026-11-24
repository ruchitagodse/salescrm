import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeEmail, normalizePhone } from "../src/lib/normalize.ts";

test("Indian ten-digit phones and formatted +91 phones identify the same number", () => {
  for (const phone of ["9876543210", "98765 43210", "+91 98765 43210"]) {
    assert.equal(normalizePhone(phone), "+919876543210");
  }
});

test("explicit international country codes are preserved", () => {
  assert.equal(normalizePhone("+44 20 7946 0018"), "+442079460018");
  assert.equal(normalizePhone("+1 202-555-0123"), "+12025550123");
});

test("missing optional identifiers are null, not empty uniqueness keys", () => {
  for (const empty of [undefined, null, "", "   "]) {
    assert.equal(normalizePhone(empty), null);
    assert.equal(normalizeEmail(empty), null);
  }
});

test("invalid phones, embedded prose, and extensions are rejected", () => {
  for (const invalid of ["123", "0000000000", "not a phone", "Call +91 9876543210", "+1 202-555-0123 ext. 5"]) {
    assert.throws(() => normalizePhone(invalid), RangeError);
  }
});

test("email matching trims and lowercases without provider-specific merging", () => {
  assert.equal(normalizeEmail("  Ruchita+Sales@EXAMPLE.COM  "), "ruchita+sales@example.com");
  assert.notEqual(normalizeEmail("ruchita+sales@example.com"), normalizeEmail("ruchita@example.com"));
});

test("normalization is idempotent", () => {
  const phone = normalizePhone("98765 43210");
  const email = normalizeEmail(" Ruchita@Example.com ");
  assert.equal(normalizePhone(phone), phone);
  assert.equal(normalizeEmail(email), email);
});
