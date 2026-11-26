import assert from "node:assert/strict";
import { test } from "node:test";
import { DEAL_OUTCOMES, PIPELINE_STAGE_KEYS, existingConversion } from "../src/lib/deal-values.ts";
import { completeDealSchema, convertDealSchema, dealListSchema, updateDealSchema } from "../src/lib/deal-validation.ts";

test("conversion starts in Discovery and cannot inject identity or closed outcomes", () => {
  assert.equal(convertDealSchema.parse({ title: " Website " }).stageKey, "discovery");
  assert.equal(convertDealSchema.parse({ title: " Website " }).title, "Website");
  for (const extra of [{ leadId: "forged" }, { contactId: "forged" }, { outcome: "won" }, { deletedAt: null }, { id: "forged" }]) {
    assert.equal(convertDealSchema.safeParse({ title: "Website", ...extra }).success, false);
  }
  assert.equal(convertDealSchema.safeParse({ title: " " }).success, false);
});
test("stages and outcomes use the approved sets independently", () => {
  assert.deepEqual(PIPELINE_STAGE_KEYS, ["discovery", "proposal", "negotiation"]);
  for (const stageKey of PIPELINE_STAGE_KEYS) for (const outcome of DEAL_OUTCOMES) {
    assert.equal(completeDealSchema.safeParse({ title: "Website", stageKey, outcome, lossReason: "Reason" }).success, true);
  }
  assert.equal(convertDealSchema.safeParse({ title: "Website", stageKey: "won" }).success, false);
  assert.equal(completeDealSchema.safeParse({ title: "Website", stageKey: "discovery", outcome: "converted" }).success, false);
});
test("loss requires a reason when the complete row is validated", () => {
  const current = { title: "Website", stageKey: "proposal", outcome: "open", lossReason: null };
  const patch = updateDealSchema.parse({ outcome: "lost" });
  assert.equal(completeDealSchema.safeParse({ ...current, ...patch }).success, false);
  assert.equal(completeDealSchema.safeParse({ ...current, ...patch, lossReason: "  Budget  " }).success, true);
  assert.equal(updateDealSchema.safeParse({}).success, false);
  assert.equal(updateDealSchema.safeParse({ stageKey: undefined }).success, false);
});
test("deal values remain exact bigint and reject negative, float and overflow inputs", () => {
  assert.equal(convertDealSchema.parse({ title: "Website", valuePaise: "9007199254740993" }).valuePaise, BigInt("9007199254740993"));
  for (const valuePaise of [100, 1.5, "1.5", "-1", "9223372036854775808"]) {
    assert.equal(convertDealSchema.safeParse({ title: "Website", valuePaise }).success, false);
  }
  assert.equal(convertDealSchema.parse({ title: "Website", valuePaise: null }).valuePaise, null);
});
test("conversion decisions preserve one-deal identity, including archived records", () => {
  assert.deepEqual(existingConversion(undefined), { kind: "create" });
  assert.deepEqual(existingConversion({ id: "same-deal", deletedAt: null }), { kind: "existing", id: "same-deal" });
  assert.deepEqual(existingConversion({ id: "same-deal", deletedAt: new Date("2026-11-25T00:00:00Z") }), { kind: "archived", id: "same-deal" });
});
test("close dates and list filters are validated", () => {
  assert.equal(convertDealSchema.safeParse({ title: "Website", expectedCloseDate: "2026-02-29" }).success, false);
  assert.equal(convertDealSchema.safeParse({ title: "Website", expectedCloseDate: "2028-02-29" }).success, true);
  assert.equal(dealListSchema.safeParse({ outcome: "unknown" }).success, false);
  assert.equal(dealListSchema.safeParse({ pageSize: 101 }).success, false);
});
