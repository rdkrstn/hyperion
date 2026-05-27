import { describe, expect, it } from 'vitest';
import { createLeadRecord, qualifyLead } from '../../leads/services/leadService';
import { createDealFromLead } from '../../deals/services/dealService';
import { addSurveyEvidence, scheduleSurvey, surveyValidationGate, validateSurvey } from './surveyService';

function dealReadyForSurvey() {
  return {
    ...createDealFromLead(qualifyLead(createLeadRecord({
      businessName: 'Factory A',
      contactName: 'Ramon Cruz',
      phone: '09190000000',
      source: 'public_inquiry',
      location: 'Laguna',
      monthlyBill: 96000,
      goal: 'lower_bill',
      siteControl: 'leased_with_authorization',
      assignedSales: 'sales-1',
    })), { name: 'Factory A solar project', salesOwner: 'sales-1' }),
    solarSnapshotStatus: 'ready' as const,
  };
}

describe('survey service', () => {
  it('requires installer, schedule, and location before creating a survey', () => {
    const deal = dealReadyForSurvey();

    expect(() => scheduleSurvey(deal, { installerId: '', scheduledAt: '2026-05-25T09:00', location: 'Laguna' })).toThrow('Installer is required');
  });

  it('blocks validation until required evidence and structural soundness are complete', () => {
    const survey = scheduleSurvey(dealReadyForSurvey(), {
      installerId: 'installer-1',
      scheduledAt: '2026-05-25T09:00',
      location: 'Laguna',
    });

    expect(surveyValidationGate(survey).allowed).toBe(false);

    const withEvidence = ['main_breaker_panel', 'roof_surface', 'inverter_location', 'wire_run_path']
      .reduce((current, category) => addSurveyEvidence(current, {
        category: category as never,
        fileName: `${category}.jpg`,
        storagePath: `survey/${category}.jpg`,
        mimeType: 'image/jpeg',
      }), survey);

    expect(surveyValidationGate({ ...withEvidence, isStructurallySound: false }).reason).toContain('remediation');
    expect(validateSurvey({ ...withEvidence, isStructurallySound: true }).validationOutcome).toBe('validated');
  });
});
