import assert from "node:assert/strict";
import { test } from "node:test";
import { formatINR, paiseToRupees, rupeesToPaise } from "../src/lib/money.ts";

test("rupee input is converted exactly to bigint paise", () => {
  assert.equal(rupeesToPaise("125000.50"), BigInt("12500050"));
  assert.equal(rupeesToPaise("0.01"), BigInt(1));
  assert.equal(rupeesToPaise(" 1.5 "), BigInt(150));
  assert.equal(rupeesToPaise("0"), BigInt(0));
  assert.equal(rupeesToPaise(""), null);
  assert.equal(rupeesToPaise("90071992547409.93"), BigInt("9007199254740993"));
});
test("budget input rejects negatives, excess decimal places, exponent and out-of-range values", () => {
  for (const value of ["-1", "1.001", "1e6", "1,25,000", ".5", "NaN", "1.", "92233720368547758.08"]) {
    assert.throws(() => rupeesToPaise(value), RangeError);
  }
  assert.equal(rupeesToPaise("92233720368547758.07"), BigInt("9223372036854775807"));
});
test("INR formatting uses Indian grouping and retains paise", () => {
  assert.equal(formatINR(BigInt("12500000")), "₹1,25,000");
  assert.equal(formatINR("12500050"), "₹1,25,000.50");
  assert.equal(formatINR("5"), "₹0.05");
  assert.equal(formatINR("0"), "₹0");
  assert.equal(formatINR(null), "—");
  assert.equal(formatINR("-101"), "-₹1.01");
  assert.equal(formatINR("9007199254740993"), "₹9,00,71,99,25,47,409.93");
  assert.throws(() => formatINR(9007199254740992), RangeError);
});
test("paise round trips through editable rupee strings without rounding", () => {
  for (const amount of ["0", "1", "10", "100", "105", "9007199254740993", "9223372036854775807"]) {
    assert.equal(rupeesToPaise(paiseToRupees(amount)), BigInt(amount));
  }
  assert.equal(paiseToRupees(null), "");
});
