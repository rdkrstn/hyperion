import { describe, expect, it } from 'vitest';
import {
  deriveInstallerWorkSummary,
  evaluateNetMeteringGate,
  syncNetMeteringWorkflow,
} from './netMetering';
import {
  buildFinancingPacket,
  buildNetMeteringWorkflow,
  buildReadinessUploads,
  calculateReadinessResult,
  readinessToLeadInput,
  sampleReadinessIntake,
} from './readiness';
import type { Deal } from '../types';

function readinessDeal(overrides: Partial<Deal> = {}): Deal {
  const intake = sampleReadinessIntake;
  const result = calculateReadinessResult(intake);
  const id = 'lead-net-metering';
  return {
    id,
    code: 'SOL-901',
    stage: 'survey_completed',
    opportunityStatus: 'open',
    archiveState: 'active',
    lead: readinessToLeadInput(intake),
    readinessIntake: intake,
    readinessResult: result,
    readinessUploads: buildReadinessUploads(id, intake),
    financingPacket: { ...buildFinancingPacket(intake, result), leadId: id },
    netMeteringWorkflow: { ...buildNetMeteringWorkflow(intake, result.recommendedSystemSizeKwp), leadId: id },
    qualification: { status: 'qualified', score: 100, missingSections: [], updatedAt: 'now' },
    assignedSales: 'Sales User',
    preAudit: {
      monthlyKwh: 4000,
      targetOffset: 0.7,
      sizeKwp: result.recommendedSystemSizeKwp,
      monthlyProduction: 4200,
      projectedSavings: 22000,
      capex: result.installerScorecard.estimatedProjectValue,
      paybackYears: 3.2,
      rtoDownpayment: 100000,
      rtoMonthly: 25000,
      bankDownpayment: 150000,
      bankMonthly: 21000,
    },
    score: { score: 86, lane: 'rent_to_own', priority: true, breakdown: [] },
    surveyJob: {
      id: 'survey-net-metering',
      assignedInstaller: 'Solar Installer Team',
      scheduledAt: '2026-05-24T10:00',
      roofCondition: 'Good condition',
      shading: 'Minimal shading',
      usableRoofArea: '95 sqm',
      mapPin: intake.location,
      siteAccessNotes: 'Access confirmed.',
      photoPlaceholders: [],
      completed: true,
    },
    documents: { electricBills: true, businessRegistration: true, validId: true, locationPin: true, roofAccess: true },
    surveyUploads: [],
    surveyApproval: { id: 'approval', surveyJobId: 'survey-net-metering', status: 'cs_validated', notes: '', updatedAt: 'now' },
    quoteRequests: [],
    csReady: false,
    tasks: [],
    aiSuggestions: [],
    billingLedger: [],
    events: [],
    ...overrides,
  };
}

describe('net-metering workflow logic', () => {
  it('blocks proposal readiness when required readiness documents are missing', () => {
    const deal = readinessDeal({
      readinessIntake: { ...sampleReadinessIntake, billUploadFileName: '' },
      readinessUploads: [],
    });
    const gate = evaluateNetMeteringGate(deal);

    expect(gate.allowed).toBe(false);
    expect(gate.missingItems).toContain('Customer bill upload');
    expect(gate.missingItems).not.toContain('Roof photo upload');
  });

  it('marks documents and technical review complete when bill, ownership, survey, and lender state are ready', () => {
    const deal = readinessDeal({
      netMeteringWorkflow: {
        ...buildNetMeteringWorkflow(sampleReadinessIntake, calculateReadinessResult(sampleReadinessIntake).recommendedSystemSizeKwp),
        leadId: 'lead-net-metering',
        status: 'ready_for_lender',
        readyForLenderAt: '2026-05-20T08:00:00Z',
      },
    });
    const synced = syncNetMeteringWorkflow(deal);

    expect(synced.steps.find((step) => step.id === 'documents')?.status).toBe('complete');
    expect(synced.steps.find((step) => step.id === 'technical_review')?.status).toBe('complete');
    expect(evaluateNetMeteringGate({ ...deal, netMeteringWorkflow: synced }).allowed).toBe(true);
  });

  it('derives installer work summary from current workflow and quote state', () => {
    const summary = deriveInstallerWorkSummary(readinessDeal({
      readinessIntake: { ...sampleReadinessIntake, billUploadFileName: '' },
      readinessUploads: [],
    }));

    expect(summary.leadScore).toBeGreaterThan(70);
    expect(summary.monthlyBillRange).toContain('PHP');
    expect(summary.missingDocuments).toContain('Customer bill upload');
    expect(summary.nextBestAction).toContain('net-metering documents');
  });
});
