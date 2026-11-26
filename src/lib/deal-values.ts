export const PIPELINE_STAGE_KEYS = ["discovery", "proposal", "negotiation"] as const;
export const DEAL_OUTCOMES = ["open", "won", "lost"] as const;
export type PipelineStageKey = (typeof PIPELINE_STAGE_KEYS)[number];
export type DealOutcome = (typeof DEAL_OUTCOMES)[number];
export const PIPELINE_STAGE_LABELS: Record<PipelineStageKey, string> = {
  discovery: "Discovery", proposal: "Proposal", negotiation: "Negotiation",
};

export function existingConversion(deal: { id: string; deletedAt: Date | null } | undefined) {
  if (!deal) return { kind: "create" } as const;
  return deal.deletedAt ? { kind: "archived", id: deal.id } as const : { kind: "existing", id: deal.id } as const;
}
