export interface ProposalScopeLine {
  id: string;
  name: string;
  category: 'panels' | 'inverter' | 'mounting' | 'electrical_bos' | 'labor' | 'compliance' | 'monitoring' | 'adder';
  quantity: number;
  unit: string;
  unitPrice: number;
  estimatedCost: number;
  marginPercent: number;
  total: number;
  sourceReason: string;
  notes?: string;
  optional: boolean;
  manuallyEdited: boolean;
}

export interface ProposalRecord {
  id: string;
  dealId: string;
  solarSnapshotId?: string;
  solarSnapshotSummary?: {
    roofCapacityKwp: number;
    maxPanels: number;
    selectedPanelCount: number;
    panelCapacityWatts: number;
    selectedSystemSizeKwp: number;
    annualProductionKwh: number;
    maxAnnualProductionKwh?: number;
    roofAreaM2?: number;
    sunshineHoursPerYear?: number;
    imageryQuality: string;
  };
  revision: number;
  previousProposalId?: string;
  status: 'draft' | 'pricing_review_needed' | 'approved' | 'shared' | 'accepted' | 'rejected';
  isActive: boolean;
  systemSizeKwp: number;
  scopeLines: ProposalScopeLine[];
  subtotal: number;
  estimatedCost: number;
  grossMarginPercent: number;
  paymentOption: string;
  frozenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalContract {
  id: string;
  dealId: string;
  proposalId: string;
  token: string;
  status: 'draft' | 'sent' | 'signed' | 'void';
  publicUrl: string;
  createdAt: string;
}

export interface InvoiceRecord {
  id: string;
  dealId: string;
  proposalId: string;
  contractId: string;
  amount: number;
  status: 'issued' | 'void';
}

export interface PaymentLedgerEvent {
  id: string;
  invoiceId: string;
  amount: number;
  providerExecution: 'mocked';
  status: 'mock_succeeded' | 'mock_failed';
}

export interface ClientRecord {
  id: string;
  dealId: string;
  businessName: string;
  contactName: string;
  location: string;
  status: 'active_client' | 'onboarding' | 'support';
}
