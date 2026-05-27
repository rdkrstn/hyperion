export type NetMeteringStepId = 'eligibility' | 'documents' | 'technical_review' | 'application' | 'metering' | 'active_credits';
export type NetMeteringStepStatus = 'missing' | 'blocked' | 'in_progress' | 'complete';

export interface NetMeteringWorkflowStepView {
  id: NetMeteringStepId;
  title: string;
  customerLabel: string;
  staffLabel: string;
  status: NetMeteringStepStatus;
  blockers: string[];
  nextAction?: string;
  slaBadge?: string;
}

export interface NetMeteringWorkflowView {
  readyForProposal: boolean;
  nextAction: string;
  steps: NetMeteringWorkflowStepView[];
}
