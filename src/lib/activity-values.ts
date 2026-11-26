export const ACTIVITY_TYPES = ["call", "meeting", "task", "follow_up"] as const;
export const ACTIVITY_STATUSES = ["planned", "completed", "cancelled"] as const;
export const ACTIVITY_TARGETS = ["contact", "lead", "deal"] as const;
export const ACTIVITY_VIEWS = ["all", "today", "upcoming", "overdue", "completed"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];
export type ActivityTargetType = (typeof ACTIVITY_TARGETS)[number];
export type ActivityView = (typeof ACTIVITY_VIEWS)[number];
export const ACTIVITY_TYPE_LABELS = { call: "Call", meeting: "Meeting", task: "Task", follow_up: "Follow-up" } as const;

export function activityTarget(row: { contactId: string | null; leadId: string | null; dealId: string | null }) {
  const entries = [["contact", row.contactId], ["lead", row.leadId], ["deal", row.dealId]] as const;
  const selected = entries.filter(([, id]) => id !== null);
  if (selected.length !== 1) throw new RangeError("Exactly one activity target is required.");
  return { targetType: selected[0][0], targetId: selected[0][1]! };
}
export function activityTargetColumns(type: ActivityTargetType, id: string) {
  return { contactId: type === "contact" ? id : null, leadId: type === "lead" ? id : null, dealId: type === "deal" ? id : null };
}
export function completionTime(previousStatus: ActivityStatus | null, previousTime: Date | null, next: ActivityStatus, now: Date) {
  return next === "completed" ? previousStatus === "completed" && previousTime ? previousTime : now : null;
}
