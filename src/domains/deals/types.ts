import type { LeadSource, LeadSnapshot } from '../leads/types';

export type DealStage = 'deal_created' | 'solar_snapshot_reviewed' | 'survey_scheduled' | 'survey_validated' | 'proposal_built' | 'client_portal_shared' | 'contract_accepted' | 'won';
export type DealStatus = 'open' | 'won' | 'lost' | 'cancelled' | 'archived';
export type SurveyStatus = 'not_scheduled' | 'scheduled' | 'evidence_pending' | 'blocked' | 'needs_engineering_review' | 'validated' | 'ready_for_proposal';
export type ProposalStatus = 'draft' | 'pricing_review_needed' | 'approved' | 'shared' | 'accepted' | 'rejected';
export type SolarSnapshotStatus = 'pending' | 'maps_pending' | 'ready' | 'low_quality' | 'override_approved';

export interface CommercialPacket {
  proposedSystemSizeKwp: number;
  estimatedPrice: number;
  grossMarginPercent: number;
  paymentOption: string;
}

export interface FinancingReadiness {
  status: 'not_started' | 'draft' | 'missing_requirements' | 'ready_for_lender' | 'submitted' | 'approved' | 'declined';
  riskFlags: string[];
  affordabilityProfile: string;
}

export interface DealRecord {
  id: string;
  leadId: string;
  name: string;
  value: number;
  stage: DealStage;
  status: DealStatus;
  source: LeadSource;
  salesOwner: string;
  expectedCloseDate: string;
  surveyStatus: SurveyStatus;
  proposalStatus: ProposalStatus;
  portalStatus: 'not_shared' | 'active' | 'paused' | 'expired';
  solarSnapshotStatus: SolarSnapshotStatus;
  dispatchOverrideStatus?: 'requested' | 'approved' | 'rejected';
  documentStatus: 'missing' | 'pending_validation' | 'validated';
  contractStatus: 'not_started' | 'draft' | 'sent' | 'signed' | 'void';
  paymentStatus: 'not_started' | 'mock_pending' | 'mock_succeeded' | 'mock_failed';
  nextAction: string;
  blocker?: string;
  leadSnapshot: LeadSnapshot;
  commercialPacket: CommercialPacket;
  financingReadiness?: FinancingReadiness;
  createdAt?: string;
  updatedAt?: string;
}
