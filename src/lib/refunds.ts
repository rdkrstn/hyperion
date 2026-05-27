import type { RefundRecord, RefundStatus, Role } from '../types';

export function canSetRefundStatus(refund: RefundRecord | undefined, actorRole: Role, target: RefundStatus) {
  if (!refund) return { allowed: false, reason: 'Refund must be requested first.' };
  if ((target === 'owner_approved' || target === 'rejected') && actorRole !== 'owner') {
    return { allowed: false, reason: 'Only owner can approve or reject refund requests.' };
  }
  if (target === 'completed' && refund.status !== 'owner_approved' && refund.status !== 'processing') {
    return { allowed: false, reason: 'Owner approval is required before refund completion.' };
  }
  return { allowed: true, reason: 'Refund status transition is allowed.' };
}
