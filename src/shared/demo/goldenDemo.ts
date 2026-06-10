import type { DealRecord } from '../../domains/deals/types';
import type { DocumentRecord } from '../../domains/documents/types';
import type { LeadRecord } from '../../domains/leads/types';
import type { ProposalRecord } from '../../domains/proposals/types';
import type { SolarSnapshot } from '../../domains/solar-snapshot/types';
import type { SurveyRecord } from '../../domains/surveys/types';
import type { SolarOpsState } from '../api/solarOpsStore';

export const goldenDemoLeadId = 'lead-demo-golden-msme';
export const goldenDemoDealId = 'deal-demo-golden-msme';
export const goldenDemoAccountName = 'Iloilo Mini Mart';

export const goldenDemoStepIds = [
  'load_demo',
  'capture',
  'qualify',
  'snapshot',
  'docs',
  'survey',
  'proposal',
  'contract',
  'won',
] as const;

export type GoldenDemoStepId = typeof goldenDemoStepIds[number];

export interface GoldenDemoStep {
  id: GoldenDemoStepId;
  label: string;
  status: 'complete' | 'current' | 'blocked' | 'pending';
}

export interface GoldenDemoModel {
  loaded: boolean;
  accountName: string;
  currentStepId: GoldenDemoStepId;
  progressPercent: number;
  nextAction: string;
  blockers: string[];
  lead?: LeadRecord;
  deal?: DealRecord;
  solarSnapshot?: SolarSnapshot;
  documents: DocumentRecord[];
  surveys: SurveyRecord[];
  activeProposal?: ProposalRecord;
  steps: GoldenDemoStep[];
  metrics: {
    readinessScore: number;
    monthlyBill: number;
    roofCapacityKwp: number;
    selectedPanels: number;
    maxPanels: number;
    selectedSystemSizeKwp: number;
    annualProductionKwh: number;
    proposalValue: number;
  };
}

const stepLabels: Record<GoldenDemoStepId, string> = {
  load_demo: 'Load demo',
  capture: 'Capture',
  qualify: 'Qualify',
  snapshot: 'Snapshot',
  docs: 'Docs',
  survey: 'Survey',
  proposal: 'Proposal',
  contract: 'Contract-ready',
  won: 'Won',
};

function hasValidatedDocument(documents: DocumentRecord[], category: DocumentRecord['category']) {
  return documents.some((document) => document.category === category && document.validationStatus === 'validated');
}

function hasSurveyValidated(surveys: SurveyRecord[]) {
  return surveys.some((survey) => survey.validationOutcome === 'validated');
}

function currentStepFor(input: {
  loaded: boolean;
  lead?: LeadRecord;
  deal?: DealRecord;
  documents: DocumentRecord[];
  surveys: SurveyRecord[];
  activeProposal?: ProposalRecord;
  contractSigned: boolean;
}): GoldenDemoStepId {
  if (!input.loaded) return 'load_demo';
  if (input.deal?.stage === 'won') return 'won';
  if (input.contractSigned || input.deal?.stage === 'contract_accepted') return 'contract';
  if (!input.activeProposal?.frozenAt) {
    const docsReady = ['customer_bill', 'valid_id', 'site_control_document'].every((category) =>
      hasValidatedDocument(input.documents, category as DocumentRecord['category']),
    );
    if (!docsReady) return 'docs';
    if (!hasSurveyValidated(input.surveys)) return 'survey';
    return 'proposal';
  }
  return 'contract';
}

function blockersFor(input: {
  loaded: boolean;
  documents: DocumentRecord[];
  surveys: SurveyRecord[];
  activeProposal?: ProposalRecord;
  currentStepId: GoldenDemoStepId;
}) {
  if (!input.loaded) return ['Golden demo data is not loaded.'];
  if (input.currentStepId === 'won') return [];
  const blockers: string[] = [];
  if (!hasValidatedDocument(input.documents, 'valid_id')) blockers.push('Valid ID pending validation');
  if (!hasValidatedDocument(input.documents, 'site_control_document')) blockers.push('Site-control document pending validation');
  if (!hasSurveyValidated(input.surveys)) blockers.push('Installer survey needed');
  if (!input.activeProposal?.frozenAt) blockers.push('Proposal not frozen');
  return blockers;
}

function nextActionFor(currentStepId: GoldenDemoStepId) {
  const labels: Record<GoldenDemoStepId, string> = {
    load_demo: 'Load golden demo',
    capture: 'Qualify account',
    qualify: 'Create deal',
    snapshot: 'Review Solar Snapshot',
    docs: 'Validate demo documents',
    survey: 'Validate installer survey',
    proposal: 'Generate proposal',
    contract: 'Complete contract-ready handoff',
    won: 'Review release docs',
  };
  return labels[currentStepId];
}

function buildSteps(currentStepId: GoldenDemoStepId): GoldenDemoStep[] {
  const currentIndex = goldenDemoStepIds.indexOf(currentStepId);
  return goldenDemoStepIds.map((id, index) => ({
    id,
    label: stepLabels[id],
    status: index < currentIndex || currentStepId === 'won' ? 'complete' : index === currentIndex ? 'current' : 'pending',
  }));
}

export function buildGoldenDemoModel(state: SolarOpsState): GoldenDemoModel {
  const lead = state.leads.find((item) => item.id === goldenDemoLeadId);
  const deal = state.deals.find((item) => item.id === goldenDemoDealId);
  const solarSnapshot = state.solarSnapshots.find((item) => item.id === 'solar-demo-golden-msme' || item.dealId === goldenDemoDealId || item.leadId === goldenDemoLeadId);
  const documents = state.documents.filter((item) => item.dealId === goldenDemoDealId || item.leadId === goldenDemoLeadId);
  const surveys = state.surveys.filter((item) => item.dealId === goldenDemoDealId || item.leadId === goldenDemoLeadId);
  const activeProposal = state.proposals.find((item) => item.dealId === goldenDemoDealId && item.isActive);
  const contractSigned = state.proposalContracts.some((item) => item.dealId === goldenDemoDealId && item.status === 'signed');
  const loaded = Boolean(lead && deal && solarSnapshot);
  const currentStepId = currentStepFor({ loaded, lead, deal, documents, surveys, activeProposal, contractSigned });
  const currentIndex = goldenDemoStepIds.indexOf(currentStepId);
  const progressPercent = currentStepId === 'won' ? 100 : Math.round((Math.max(0, currentIndex) / (goldenDemoStepIds.length - 1)) * 100);

  return {
    loaded,
    accountName: lead?.businessName ?? goldenDemoAccountName,
    currentStepId,
    progressPercent,
    nextAction: nextActionFor(currentStepId),
    blockers: blockersFor({ loaded, documents, surveys, activeProposal, currentStepId }),
    lead,
    deal,
    solarSnapshot,
    documents,
    surveys,
    activeProposal,
    steps: buildSteps(currentStepId),
    metrics: {
      readinessScore: lead?.readinessScore ?? 0,
      monthlyBill: lead?.energyProfile.monthlyBill ?? 0,
      roofCapacityKwp: solarSnapshot?.roofCapacityKwp ?? 0,
      selectedPanels: solarSnapshot?.selectedPanelCount ?? 0,
      maxPanels: solarSnapshot?.maxPanels ?? 0,
      selectedSystemSizeKwp: solarSnapshot?.selectedSystemSizeKwp ?? 0,
      annualProductionKwh: solarSnapshot?.annualProductionKwh ?? 0,
      proposalValue: activeProposal?.subtotal ?? deal?.value ?? 0,
    },
  };
}
