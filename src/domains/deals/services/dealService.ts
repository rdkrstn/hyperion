import { makeId, nowIso, type StageAction } from '../../../shared/types/app';
import { canCreateDealFromLead, leadSnapshot } from '../../leads/services/leadService';
import type { LeadRecord } from '../../leads/types';
import type { DealRecord, DealStatus } from '../types';

export function createDealFromLead(lead: LeadRecord, input: { name: string; salesOwner: string; expectedCloseDate?: string }): DealRecord {
  const gate = canCreateDealFromLead(lead);
  if (!gate.allowed) {
    throw new Error(`Lead is not qualified for deal creation: ${gate.missing.join(', ')}`);
  }
  const createdAt = nowIso();
  return {
    id: makeId('deal'),
    leadId: lead.id,
    name: input.name,
    value: 0,
    stage: 'deal_created',
    status: 'open',
    source: lead.source,
    salesOwner: input.salesOwner,
    expectedCloseDate: input.expectedCloseDate ?? '',
    surveyStatus: 'not_scheduled',
    proposalStatus: 'draft',
    portalStatus: 'not_shared',
    solarSnapshotStatus: 'pending',
    documentStatus: 'missing',
    contractStatus: 'not_started',
    paymentStatus: 'not_started',
    nextAction: 'Run Solar Snapshot.',
    leadSnapshot: leadSnapshot(lead),
    commercialPacket: {
      proposedSystemSizeKwp: 0,
      estimatedPrice: 0,
      grossMarginPercent: 0,
      paymentOption: 'cash',
    },
    financingReadiness: {
      status: 'draft',
      riskFlags: [],
      affordabilityProfile: 'Pending lender packet.',
    },
    createdAt,
    updatedAt: createdAt,
  };
}

export function scheduleSurveyGate(deal: DealRecord) {
  if (deal.solarSnapshotStatus === 'ready' || deal.solarSnapshotStatus === 'override_approved' || deal.dispatchOverrideStatus === 'approved') {
    return { allowed: true, reason: 'Solar Snapshot reviewed or dispatch override approved.' };
  }
  return {
    allowed: false,
    reason: deal.solarSnapshotStatus === 'low_quality'
      ? 'Manual dispatch override is required because Solar Snapshot quality is low.'
      : 'Solar Snapshot must be reviewed before survey scheduling.',
  };
}

export function getDealPrimaryAction(deal: DealRecord): StageAction {
  if (deal.stage === 'deal_created') return { id: 'run_solar_snapshot', label: 'Run Solar Snapshot', enabled: true, reason: 'Verify roof capacity before installer dispatch.' };
  if (deal.stage === 'solar_snapshot_reviewed') return { id: 'schedule_survey', label: 'Schedule Survey', enabled: scheduleSurveyGate(deal).allowed, reason: scheduleSurveyGate(deal).reason };
  if (deal.stage === 'survey_scheduled') return { id: 'view_survey', label: 'View Survey', enabled: true, reason: 'Installer must complete evidence and findings.' };
  if (deal.stage === 'survey_validated') return { id: 'build_proposal', label: 'Build Proposal', enabled: true, reason: 'Technical validation is complete.' };
  if (deal.stage === 'proposal_built') return { id: 'share_portal', label: 'Share Client Portal', enabled: true, reason: 'Proposal is ready for customer review.' };
  if (deal.stage === 'client_portal_shared') return { id: 'send_contract', label: 'Send Contract', enabled: true, reason: 'Portal is shared; send active frozen proposal contract.' };
  if (deal.stage === 'contract_accepted') return { id: 'mark_won', label: 'Mark Won', enabled: true, reason: 'Contract accepted and client record created.' };
  return { id: 'view', label: 'View Deal', enabled: true, reason: 'Deal is complete.' };
}

export function markDealOutcome(deal: DealRecord, status: DealStatus, reason: string): DealRecord {
  return {
    ...deal,
    status,
    stage: status === 'won' ? 'won' : deal.stage,
    nextAction: status === 'lost' ? `Lost: ${reason}` : status === 'won' ? 'Start installation / net-metering / aftersales.' : deal.nextAction,
    updatedAt: nowIso(),
  };
}
