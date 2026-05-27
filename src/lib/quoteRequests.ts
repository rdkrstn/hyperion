import { createQuoteDraft } from './quoteBuilder';
import { failure, success } from './actionFeedback';
import { canRolePerform } from './rbac';
import type { ActionResult, CheckoutEstimate, Deal, QuoteRequest, QuoteRequestStatus, Role } from '../types';

function stamp() {
  return new Date().toLocaleString('en-PH');
}

function id(dealId: string) {
  return `quote-${dealId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function canManageQuote(role: Role) {
  return canRolePerform(role, 'manage_quote_request');
}

function isOpen(status: QuoteRequestStatus) {
  return status === 'requested' || status === 'reviewing' || status === 'approved';
}

export function createQuoteRequest(deal: Deal, actorRole: Role, note: string): ActionResult<QuoteRequest> {
  if (!canManageQuote(actorRole)) return failure('Only sales or owner can create quote requests.');
  if (deal.quoteRequests.some((request) => isOpen(request.status))) return failure('A quote request is already open for this opportunity.');

  return success('Quote request created.', {
    id: id(deal.id),
    dealId: deal.id,
    status: 'requested',
    requestedBy: actorRole,
    requestedAt: stamp(),
    note: note.trim() || 'Staff requested a solar package quote.',
  });
}

function reviewQuoteRequest(
  request: QuoteRequest,
  actorRole: Role,
  status: QuoteRequestStatus,
  message: string,
  reason = '',
): ActionResult<QuoteRequest> {
  if (!canManageQuote(actorRole)) return failure('Only sales or owner can manage quote requests.');
  if (request.status === 'converted_to_checkout') return failure('Converted quote requests cannot be changed.');
  return success(message, {
    ...request,
    status,
    reviewedBy: actorRole,
    reviewedAt: stamp(),
    rejectionReason: reason || request.rejectionReason,
  });
}

export function approveQuoteRequest(request: QuoteRequest, actorRole: Role) {
  return reviewQuoteRequest(request, actorRole, 'approved', 'Quote request approved.');
}

export function rejectQuoteRequest(request: QuoteRequest, actorRole: Role, reason: string) {
  return reviewQuoteRequest(request, actorRole, 'rejected', 'Quote request rejected.', reason);
}

export function cancelQuoteRequest(request: QuoteRequest, actorRole: Role, reason: string) {
  return reviewQuoteRequest(request, actorRole, 'cancelled', 'Quote request cancelled.', reason);
}

export function convertQuoteRequestToCheckout(
  deal: Deal,
  request: QuoteRequest,
  actorRole: Role,
): ActionResult<{ quoteRequest: QuoteRequest; estimate: CheckoutEstimate }> {
  if (!canManageQuote(actorRole)) return failure('Only sales or owner can convert quote requests.');
  if (request.status !== 'approved') return failure('Quote request must be approved before checkout conversion.');
  if (deal.stage !== 'survey_completed' || !deal.preAudit || !deal.surveyJob?.completed) {
    return failure('Survey completion and pre-audit are required before checkout conversion.');
  }
  const estimate = deal.checkoutEstimate ?? createQuoteDraft(deal);
  return success('Quote request converted to checkout estimate.', {
    quoteRequest: { ...request, status: 'converted_to_checkout', reviewedBy: actorRole, reviewedAt: stamp(), convertedAt: stamp() },
    estimate,
  });
}
