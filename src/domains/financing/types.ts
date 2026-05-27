export type FinancingReadinessStatus = 'not_started' | 'draft' | 'missing_requirements' | 'ready_for_lender' | 'submitted' | 'approved' | 'declined';

export interface FinancingReadinessPacket {
  status: FinancingReadinessStatus;
  billSummary: string;
  systemSizeKwp?: number;
  savingsRange?: string;
  paybackRange?: string;
  affordabilityProfile: string;
  siteReadinessScore?: number;
  installerQuoteStatus: 'missing' | 'draft' | 'validated';
  netMeteringStatus: 'missing' | 'in_progress' | 'ready_for_lender';
  riskFlags: string[];
}
