import type { Deal, OpportunityStatus, Role } from '../types';

export const opportunityStatusLabels: Record<OpportunityStatus, string> = {
  open: 'Open',
  won: 'Won',
  lost: 'Lost',
  cancelled: 'Cancelled',
  archived: 'Archived',
};

export function opportunityDealValue(deal: Deal) {
  if (deal.proposal?.projectPrice) return deal.proposal.projectPrice;
  if (deal.checkoutEstimate?.total) return deal.checkoutEstimate.total;
  if (deal.preAudit?.capex) return deal.preAudit.capex;
  return 0;
}

export function canSetOpportunityStatus(actorRole: Role, status: OpportunityStatus) {
  if (status === 'archived') return { allowed: false, reason: 'Use archive actions to archive opportunities.' };
  if (status === 'cancelled') return { allowed: false, reason: 'Use cancellation workflow to cancel opportunities.' };
  if (actorRole === 'sales' || actorRole === 'owner') return { allowed: true, reason: 'Sales or owner can update opportunity outcome.' };
  return { allowed: false, reason: 'Only sales or owner can mark opportunities won, lost, or open.' };
}
