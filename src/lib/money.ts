const HUNDRED = BigInt(100);
const ZERO = BigInt(0);
const MAX_PAISE = BigInt("9223372036854775807");

export function rupeesToPaise(input: string): bigint | null {
  const value = input.trim();
  if (!value) return null;
  if (value.length > 22 || !/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new RangeError("Enter non-negative rupees with at most two decimal places.");
  }
  const [whole, fraction = ""] = value.split(".");
  const amount = BigInt(whole) * HUNDRED + BigInt(fraction.padEnd(2, "0"));
  if (amount > MAX_PAISE) throw new RangeError("Budget exceeds the supported range.");
  return amount;
}

function exactPaise(value: bigint | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) throw new RangeError("Invalid paise value.");
  return BigInt(value);
}

export function paiseToRupees(value: bigint | string | null): string {
  if (value === null) return "";
  const amount = exactPaise(value);
  const negative = amount < ZERO;
  const absolute = negative ? -amount : amount;
  const fraction = absolute % HUNDRED;
  return `${negative ? "-" : ""}${absolute / HUNDRED}${fraction === ZERO ? "" : `.${fraction.toString().padStart(2, "0")}`}`;
}

export function formatINR(value: bigint | string | null): string {
  if (value === null) return "—";
  const amount = exactPaise(value);
  const negative = amount < ZERO;
  const absolute = negative ? -amount : amount;
  const fraction = absolute % HUNDRED;
  const whole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(absolute / HUNDRED);
  return `${negative ? "-" : ""}₹${whole}${fraction === ZERO ? "" : `.${fraction.toString().padStart(2, "0")}`}`;
}
