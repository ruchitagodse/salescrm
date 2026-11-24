export const LEAD_SOURCES = [
  "instagram", "whatsapp", "meta_ads", "website", "referral", "cold_outreach", "other",
] as const;
export const LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "lost"] as const;
export const LEAD_ENTRY_METHODS = ["manual", "integration"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadEntryMethod = (typeof LEAD_ENTRY_METHODS)[number];
