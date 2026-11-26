import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateItems, canChangeQuotation, documentReference, MAX_PAISE, QUOTATION_STATUSES, receiptFits } from "../src/lib/finance-values.ts";
import { expenseInputSchema, paymentInputSchema, quotationInputSchema, voidInputSchema } from "../src/lib/finance-validation.ts";
const id = "1d79eb24-a7cc-4ce3-90ae-67cb5724b956";
const item = { description: "Website", quantity: 2, unitPricePaise: BigInt("12500050") };
test("line totals and document totals are exact paise, including above JS safe integer", () => {
  const result = calculateItems([item, { description: "Hosting", quantity: 1, unitPricePaise: BigInt("9007199254740993") }]);
  assert.equal(result.lines[0].lineTotalPaise, BigInt("25000100"));
  assert.equal(result.totalPaise, BigInt("9007199279741093"));
  assert.equal(calculateItems([{ ...item, quantity: 1, unitPricePaise: BigInt(0) }]).totalPaise, BigInt(0));
});
test("calculations reject overflow, floats, negative prices, invalid quantity and empty items", () => {
  for (const lines of [[], [{ ...item, quantity: 1.5 }], [{ ...item, quantity: 0 }], [{ ...item, unitPricePaise: 100 }], [{ ...item, unitPricePaise: BigInt(-1) }], [{ ...item, unitPricePaise: MAX_PAISE }], [{ ...item, quantity: 1, unitPricePaise: MAX_PAISE }, { ...item, quantity: 1 }]]) {
    assert.throws(() => calculateItems(lines), RangeError);
  }
});
test("calculated lines are copies and cannot change when the input is edited", () => {
  const original = { ...item };
  const snapshot = calculateItems([original]);
  original.unitPricePaise = BigInt(1);
  assert.equal(snapshot.lines[0].unitPricePaise, item.unitPricePaise);
  assert.equal(snapshot.totalPaise, BigInt("25000100"));
});
test("quotation transition matrix freezes accepted documents", () => {
  const allowed = ["draft:sent", "sent:accepted", "sent:rejected", "rejected:draft"];
  for (const from of QUOTATION_STATUSES) for (const to of QUOTATION_STATUSES) assert.equal(canChangeQuotation(from, to), allowed.includes(`${from}:${to}`));
});
test("references pad without truncating larger sequence numbers", () => {
  assert.equal(documentReference("Q", BigInt(1)), "Q-000001");
  assert.equal(documentReference("O", "1000000"), "O-1000000");
});
test("partial receipt checks allow exact settlement and reject overpayment/negative/refund/zero amounts", () => {
  assert.equal(receiptFits(BigInt(100), BigInt(30), BigInt(70)), true);
  assert.equal(receiptFits(BigInt(100), BigInt(30), BigInt(71)), false);
  assert.equal(receiptFits(BigInt(100), BigInt(0), BigInt(0)), false);
  assert.equal(receiptFits(BigInt(100), BigInt(0), BigInt(-1)), false);
  assert.equal(receiptFits(BigInt(0), BigInt(0), BigInt(1)), false);
  assert.equal(receiptFits(MAX_PAISE, MAX_PAISE - BigInt(1), BigInt(1)), true);
});
test("quotation schema excludes caller totals, tax/discount fields and non-whole quantities", () => {
  const value = { title: " Website ", dealId: id, items: [{ description: "Website", quantity: "2", unitPricePaise: "100" }] };
  assert.equal(quotationInputSchema.parse(value).items[0].unitPricePaise, BigInt(100));
  for (const extra of [{ totalPaise: "1" }, { gst: "18" }, { discountPaise: "10" }, { status: "accepted" }]) assert.equal(quotationInputSchema.safeParse({ ...value, ...extra }).success, false);
  for (const quantity of ["1.5", "1e3", 1.5, "0", "1000001"]) assert.equal(quotationInputSchema.safeParse({ ...value, items: [{ ...value.items[0], quantity }] }).success, false);
});
test("receipts/expenses require positive exact amounts and valid dates; voiding requires a reason", () => {
  const payment = { orderId: id, amountPaise: "100", paidOn: "2026-11-25" };
  assert.equal(paymentInputSchema.safeParse(payment).success, true);
  for (const amountPaise of [100, "0", "-1", "1.5", "9223372036854775808"]) assert.equal(paymentInputSchema.safeParse({ ...payment, amountPaise }).success, false);
  assert.equal(paymentInputSchema.safeParse({ ...payment, paidOn: "2026-02-29" }).success, false);
  assert.equal(paymentInputSchema.safeParse({ ...payment, status: "voided" }).success, false);
  assert.equal(expenseInputSchema.safeParse({ spentOn: "2026-11-25", payee: "Vendor", category: "Tools", amountPaise: "100" }).success, true);
  assert.equal(voidInputSchema.safeParse({ reason: " " }).success, false);
  assert.equal(voidInputSchema.parse({ reason: " Duplicate " }).reason, "Duplicate");
});
