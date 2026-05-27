import { describe, expect, it } from 'vitest';
import { buildNetMeteringWorkflowView } from './netMeteringWorkflowService';
import { createDocumentRecord, validateDocument } from '../../documents/services/documentService';
import type { DealRecord } from '../../deals/types';
import type { SurveyRecord } from '../../surveys/types';
import type { DocumentRecord } from '../../documents/types';

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

function doc(category: DocumentRecord['category']) {
  return validateDocument(createDocumentRecord({
    leadId: 'lead-1',
    category,
    fileName: `${category}.pdf`,
    mimeType: 'application/pdf',
    storagePath: `lead-1/${category}.pdf`,
    uploadedBy: 'sales-1',
  }), 'cs-1');
}

describe('net-metering workflow service', () => {
  it('shows exact blockers when validated docs or technical review are missing', () => {
    const view = buildNetMeteringWorkflowView({
      deal,
      documents: [doc('customer_bill')],
      surveys: [],
      utilityProvider: 'Meralco',
    });

    expect(view.readyForProposal).toBe(false);
    expect(view.steps.find((step) => step.id === 'documents')?.blockers).toEqual([
      'Valid ID must be uploaded and validated.',
      'Site-Control Document must be uploaded and validated.',
    ]);
    expect(view.steps.find((step) => step.id === 'technical_review')?.blockers).toContain('Installer survey must be validated.');
  });

  it('marks workflow ready for proposal when eligibility, documents, and technical review pass', () => {
    const survey: SurveyRecord = {
      id: 'survey-1',
      leadId: 'lead-1',
      dealId: 'deal-1',
      installerId: 'installer-1',
      scheduledAt: '2026-06-01T09:00:00.000Z',
      location: 'Makati',
      validationOutcome: 'validated',
      evidenceUploads: [],
      findings: { safetyRisks: [] },
      blockers: [],
      createdAt: '2026-05-22T00:00:00.000Z',
      updatedAt: '2026-05-22T00:00:00.000Z',
    };

    const view = buildNetMeteringWorkflowView({
      deal,
      documents: [doc('customer_bill'), doc('valid_id'), doc('site_control_document')],
      surveys: [survey],
      utilityProvider: 'Meralco',
    });

    expect(view.readyForProposal).toBe(true);
    expect(view.nextAction).toBe('Net-metering gates are ready for proposal.');
    expect(view.steps.slice(0, 3).every((step) => step.status === 'complete')).toBe(true);
  });
});
