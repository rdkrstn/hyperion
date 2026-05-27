import { describe, expect, it } from 'vitest';
import { createProposalDraft, freezeProposal, generateContract, acceptContract } from './proposalService';
import type { DealRecord } from '../../deals/types';

const deal: DealRecord = {
  id: 'deal-1',
  leadId: 'lead-1',
  name: 'Bakery solar project',
  value: 0,
  stage: 'survey_validated',
  status: 'open',
  source: 'd2d',
  salesOwner: 'sales-1',
  expectedCloseDate: '2026-06-30',
  surveyStatus: 'validated',
  proposalStatus: 'draft',
  portalStatus: 'not_shared',
  solarSnapshotStatus: 'ready',
  documentStatus: 'validated',
  contractStatus: 'not_started',
  paymentStatus: 'not_started',
  nextAction: 'Build proposal.',
  leadSnapshot: {
    leadId: 'lead-1',
    businessName: 'Bakery',
    contactName: 'Maria',
    location: 'Makati',
    monthlyBill: 60000,
    goal: 'lower_bill',
    siteControl: 'owned',
    readinessScore: 82,
  },
  commercialPacket: {
    proposedSystemSizeKwp: 18,
    estimatedPrice: 0,
    grossMarginPercent: 0,
    paymentOption: 'cash',
  },
};

describe('proposal service', () => {
  it('supports many proposal revisions with one active frozen proposal', () => {
    const draft = createProposalDraft(deal, { systemSizeKwp: 18 });
    const frozen = freezeProposal(draft);
    const revision = createProposalDraft(deal, { systemSizeKwp: 20, previousProposalId: frozen.id });

    expect(frozen.status).toBe('approved');
    expect(frozen.isActive).toBe(true);
    expect(revision.revision).toBe(2);
  });

  it('freezes the selected Solar Snapshot panel allocation into proposal scope', () => {
    const draft = createProposalDraft(deal, {
      systemSizeKwp: 18,
      solarSnapshot: {
        id: 'solar-1',
        leadId: 'lead-1',
        dealId: 'deal-1',
        status: 'ready',
        imageryQuality: 'HIGH',
        roofCapacityKwp: 9.86,
        maxPanels: 17,
        panelCapacityWatts: 580,
        selectedPanelCount: 13,
        selectedSystemSizeKwp: 7.54,
        annualProductionKwh: 10933,
        riskFlags: [],
        nextAction: 'Build proposal.',
        createdAt: '2026-05-22T00:00:00.000Z',
        updatedAt: '2026-05-22T00:00:00.000Z',
      },
    });

    expect(draft.systemSizeKwp).toBe(7.54);
    expect(draft.solarSnapshotSummary?.selectedPanelCount).toBe(13);
    expect(draft.scopeLines.find((line) => line.category === 'panels')?.quantity).toBe(13);
  });


  it('accepts only active frozen proposal contracts and creates client/payment records', () => {
    const frozen = freezeProposal(createProposalDraft(deal, { systemSizeKwp: 18 }));
    const contract = generateContract(frozen, deal);
    const acceptance = acceptContract(contract, frozen, deal, 'Maria Santos');

    expect(acceptance.client.businessName).toBe('Bakery');
    expect(acceptance.invoice.status).toBe('issued');
    expect(acceptance.paymentLedgerEvent.providerExecution).toBe('mocked');
  });
});
