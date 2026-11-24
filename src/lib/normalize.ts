import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export function normalizePhone(value: string | null | undefined): string | null {
  const input = value?.trim();
  if (!input) return null;
  const phone = parsePhoneNumberFromString(input, { defaultCountry: "IN", extract: false });
  // Extensions cannot be represented in the stored E.164 identity.
  if (!phone || !phone.isValid() || phone.ext) throw new RangeError("Invalid phone number");
  return phone.number;
}

export function normalizeEmail(value: string | null | undefined): string | null {
  return value?.trim().toLowerCase() || null;
}
