import type { Deal, LeadStage } from '../types';
import { evaluateNetMeteringGate } from './netMetering';

export interface GateResult {
  allowed: boolean;
  reason: string;
}

function docsReady(deal: Deal) {
  const docs = deal.documents;
  return docs.electricBills && docs.businessRegistration && docs.validId && docs.locationPin && docs.roofAccess;
}

export function isInstallerSurveyValidated(deal: Deal) {
  const status = deal.surveyApproval?.status;
  return status === 'installer_validated' || status === 'cs_validated' || status === 'owner_approved';
}

export function canAdvanceStage(deal: Deal, target: LeadStage): GateResult {
  switch (target) {
    case 'pre_audit_done':
      return deal.preAudit && deal.score
        ? { allowed: true, reason: 'Pre-audit snapshot and score are saved.' }
        : { allowed: false, reason: 'Run pre-audit before advancing.' };
    case 'survey_assigned':
      if (!deal.preAudit || !deal.score) return { allowed: false, reason: 'Pre-audit and fit score are required.' };
      if (!deal.score.priority || deal.score.lane === 'nurture') return { allowed: false, reason: 'Only qualified priority leads can be sent to survey.' };
      return { allowed: true, reason: 'Qualified for installer handoff.' };
    case 'survey_completed':
      return deal.surveyJob?.completed
        ? { allowed: true, reason: 'Survey checklist is complete.' }
        : { allowed: false, reason: 'Installer survey must be completed.' };
    case 'proposal_ready':
      if (deal.stage !== 'survey_completed') return { allowed: false, reason: 'Survey completion is required before proposal.' };
      {
        const netMeteringGate = evaluateNetMeteringGate(deal);
        if (!netMeteringGate.allowed) return { allowed: false, reason: netMeteringGate.reason };
      }
      if (!isInstallerSurveyValidated(deal)) {
        return { allowed: false, reason: 'Installer must validate required survey evidence before proposal.' };
      }
      if (!deal.checkoutEstimate || deal.checkoutEstimate.status !== 'frozen' || deal.checkoutEstimate.approvalStatus === 'needs_pricing_approval') {
        return { allowed: false, reason: 'Freeze the formal checkout estimate and resolve pricing approval before proposal.' };
      }
      return deal.proposal && deal.contract
        ? { allowed: true, reason: 'Proposal, checkout estimate, and contract link are ready.' }
        : { allowed: false, reason: 'Generate checkout estimate, proposal snapshot, and contract link.' };
    case 'cs_review':
      if (!deal.proposal || !deal.contract || !deal.checkoutEstimate) return { allowed: false, reason: 'Proposal, checkout estimate, and contract are required for CS.' };
      if (deal.contract.status !== 'signed' || !deal.contract.acceptance) return { allowed: false, reason: 'Typed contract acceptance is required before CS review.' };
      if (!deal.invoice || !deal.billingTransaction) return { allowed: false, reason: 'Invoice and mocked billing transaction are required for CS review.' };
      return { allowed: true, reason: 'Signed contract, invoice, and billing transaction are ready for CS.' };
    case 'owner_review':
      if (deal.stage !== 'cs_review') return { allowed: false, reason: 'CS must own the deal before owner review.' };
      if (!docsReady(deal)) return { allowed: false, reason: 'CS must complete the required document checklist.' };
      if (!deal.csReady) return { allowed: false, reason: 'CS readiness must be marked complete.' };
      return { allowed: true, reason: 'Ready for owner review.' };
    case 'approved':
      return deal.stage === 'owner_review'
        ? { allowed: true, reason: 'Owner can approve or request changes.' }
        : { allowed: false, reason: 'Deal must be in owner review.' };
    case 'nurture':
      return { allowed: true, reason: 'Nurture is allowed for low-priority leads.' };
    case 'captured':
      return { allowed: true, reason: 'Initial captured stage.' };
    default:
      return { allowed: false, reason: 'Unsupported stage transition.' };
  }
}

export function nextRequiredAction(deal: Deal) {
  if (!deal.preAudit || !deal.score) return 'Run pre-audit and save the scoring snapshot.';
  if (deal.score.lane === 'nurture') return 'Send nurture sequence instead of using installer time.';
  if (!deal.surveyJob) return 'Assign installer survey handoff.';
  if (!deal.surveyJob.completed) return 'Complete roof, shading, map pin, site access, and photo checklist.';
  {
    const netMeteringGate = evaluateNetMeteringGate(deal);
    if (!netMeteringGate.allowed) return `Complete net-metering requirements: ${netMeteringGate.missingItems.join(', ') || 'workflow review'}.`;
  }
  if (!isInstallerSurveyValidated(deal)) return 'Upload required survey evidence and complete installer validation.';
  if (!deal.checkoutEstimate) return 'Build checkout estimate from the standard solar package.';
  if (deal.checkoutEstimate.status !== 'frozen') return 'Review and freeze the formal checkout estimate.';
  if (deal.checkoutEstimate.approvalStatus === 'needs_pricing_approval') return 'Owner or manager must approve pricing before contract.';
  if (!deal.proposal || !deal.contract) return 'Generate proposal snapshot and public contract link from checkout estimate.';
  if (deal.contract.status !== 'signed') return 'Capture typed contract acceptance through the public signing link.';
  if (!deal.invoice || !deal.billingTransaction) return 'Create invoice and mocked billing transaction from signed contract.';
  if (!docsReady(deal) || !deal.csReady) return 'Complete CS document checklist and payment readiness.';
  if (deal.stage !== 'owner_review') return 'Submit to owner review.';
  return 'Owner can approve, reject, or request changes.';
}
