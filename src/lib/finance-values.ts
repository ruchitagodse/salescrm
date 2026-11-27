export const QUOTATION_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"] as const;
export const FINANCIAL_STATUSES = ["recorded", "voided"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];
export const MAX_PAISE = BigInt("9223372036854775807");
export function documentReference(kind: "Q" | "O", number: bigint | string) {
  return `${kind}-${number.toString().padStart(6, "0")}`;
}
export function calculateItems(items: readonly { description: string; quantity: number; unitPricePaise: bigint }[]) {
  if (!items.length || items.length > 100) throw new RangeError("Invalid item count");
  let totalPaise = BigInt(0);
  const lines = items.map((item, position) => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1_000_000 || typeof item.unitPricePaise !== "bigint" || item.unitPricePaise < BigInt(0)) throw new RangeError("Invalid item");
    const lineTotalPaise = item.unitPricePaise * BigInt(item.quantity);
    totalPaise += lineTotalPaise;
    if (lineTotalPaise > MAX_PAISE || totalPaise > MAX_PAISE) throw new RangeError("Total exceeds supported range");
    return { ...item, position, lineTotalPaise };
  });
  return { lines, totalPaise };
}
export function canChangeQuotation(from: QuotationStatus, to: QuotationStatus) {
  return (from === "draft" && to === "sent") || (from === "sent" && (to === "accepted" || to === "rejected")) || ((from === "draft" || from === "sent") && to === "expired");
}
export function quotationTotals(subtotal:bigint,discount:bigint,tax:bigint,milestones:readonly {label:string;amountPaise:string}[]=[]){
  if(discount<BigInt(0)||tax<BigInt(0)||discount>subtotal)throw new RangeError('Invalid adjustments');
  const total=subtotal-discount+tax;if(total>MAX_PAISE)throw new RangeError('Total exceeds supported range');
  if(milestones.length && milestones.reduce((sum,m)=>sum+BigInt(m.amountPaise),BigInt(0))!==total)throw new RangeError('Milestones must equal total');
  return total;
}
export function receiptFits(total: bigint, paid: bigint, amount: bigint) {
  return total >= BigInt(0) && paid >= BigInt(0) && amount > BigInt(0) && amount <= MAX_PAISE && paid + amount <= total;
}
