import { describe, expect, it } from 'vitest';
import { buildProposalPresentation } from './proposalPresentationService';
import { createProposalDraft, freezeProposal } from './proposalService';
import type { DealRecord } from '../../deals/types';

function deal(customerType: 'residential' | 'commercial'): DealRecord {
  return {
    id: `deal-${customerType}`,
    leadId: `lead-${customerType}`,
    name: `${customerType} solar project`,
    value: 0,
    stage: 'proposal_built',
    status: 'open',
    source: 'd2d',
    salesOwner: 'sales-1',
    expectedCloseDate: '2026-06-30',
    surveyStatus: 'validated',
    proposalStatus: 'approved',
    portalStatus: 'not_shared',
    solarSnapshotStatus: 'ready',
    documentStatus: 'validated',
    contractStatus: 'sent',
    paymentStatus: 'not_started',
    nextAction: 'Send contract.',
    leadSnapshot: {
      leadId: `lead-${customerType}`,
      businessName: customerType === 'residential' ? 'Johnred House' : 'Johnred Bakery',
      contactName: 'Johnred',
      location: 'Iloilo',
      monthlyBill: customerType === 'residential' ? 9000 : 60000,
      goal: customerType === 'residential' ? 'lower_bill' : 'business_continuity',
      siteControl: 'owned',
      readinessScore: 86,
    },
    commercialPacket: {
      proposedSystemSizeKwp: 5.5,
      estimatedPrice: 0,
      grossMarginPercent: 0,
      paymentOption: 'cash',
    },
  };
}

describe('proposal presentation service', () => {
  it('uses residential use-case sections for household proposals', () => {
    const residentialDeal = deal('residential');
    const presentation = buildProposalPresentation({
      deal: residentialDeal,
      proposal: freezeProposal(createProposalDraft(residentialDeal, { systemSizeKwp: 5.5 })),
      customerType: 'residential',
      netMeteringSteps: [],
    });

    expect(presentation.useCaseSection.kind).toBe('residential');
    expect(presentation.useCaseSection.items.map((item) => item.title)).toContain('Inverter Aircon 1.5HP');
  });

  it('uses MSME continuity and financing sections for commercial proposals', () => {
    const commercialDeal = deal('commercial');
    const presentation = buildProposalPresentation({
      deal: commercialDeal,
      proposal: freezeProposal(createProposalDraft(commercialDeal, { systemSizeKwp: 12 })),
      customerType: 'commercial',
      netMeteringSteps: [],
    });

    expect(presentation.useCaseSection.kind).toBe('commercial');
    expect(presentation.useCaseSection.items.map((item) => item.title)).toContain('Business continuity');
  });
});
