export class ContactMatchConflict extends Error {
  constructor() { super("Phone and email match different contacts."); }
}

export function selectContactMatch(matches: readonly { id: string }[]): string | null {
  const ids = [...new Set(matches.map((row) => row.id))];
  if (ids.length > 1) throw new ContactMatchConflict();
  return ids[0] ?? null;
}

type FillFields = {
  fullName: string;
  companyId?: string | null; email?: string | null; phone?: string | null;
  instagramHandle?: string | null; city?: string | null; notes?: string | null;
};

export function contactFillPatch(existing: FillFields, incoming: FillFields): Partial<FillFields> {
  const patch: Partial<FillFields> = {};
  for (const key of ["fullName", "companyId", "email", "phone", "instagramHandle", "city", "notes"] as const) {
    if (!existing[key]?.trim() && incoming[key]?.trim()) patch[key] = incoming[key];
  }
  return patch;
}

export function convertedAtForStatus(
  previousStatus: string | null, previousTime: Date | null, nextStatus: string, now: Date,
): Date | null {
  return nextStatus === "converted" && previousStatus !== "converted" ? now : previousTime;
}
