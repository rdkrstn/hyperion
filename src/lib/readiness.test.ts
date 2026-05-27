import { describe, expect, it } from 'vitest';
import {
  buildFinancingPacket,
  buildNetMeteringWorkflow,
  calculateReadinessResult,
  canRemoveLead,
  emptyRuntimeState,
  sampleReadinessIntake,
} from './readiness';

describe('solar readiness navigator', () => {
  it('starts runtime collections empty when no Supabase data is loaded', () => {
    expect(emptyRuntimeState.deals).toEqual([]);
    expect(emptyRuntimeState.clients).toEqual([]);
    expect(emptyRuntimeState.staff).toEqual([]);
  });

  it('maps intake fields into readiness, savings, packet, and installer priority outputs', () => {
    const result = calculateReadinessResult(sampleReadinessIntake);

    expect(result.readinessScore).toBeGreaterThanOrEqual(70);
    expect(result.recommendedSystemSizeKwp).toBeGreaterThan(0);
    expect(result.monthlySavingsLow).toBeLessThan(result.monthlySavingsHigh);
    expect(result.installerSurveyPriority).toBe('high');
    expect(result.lenderPacketStatus).toBe('ready_for_lender');
    expect(result.netMeteringChecklist.length).toBeGreaterThan(2);
    expect(result.installerScorecard.riskLevel).toBe('low');
  });

  it('initializes embedded net-metering workflow steps from location and ownership', () => {
    const workflow = buildNetMeteringWorkflow(sampleReadinessIntake);

    expect(workflow.utilityProvider).toBe(sampleReadinessIntake.utilityProvider);
    expect(workflow.steps.map((step) => step.id)).toEqual(['eligibility', 'documents', 'technical_review', 'application', 'metering', 'active_credits']);
    expect(workflow.steps[0].customerLabel).toContain('Likely eligible');
    expect(workflow.steps[1].adminLabel).toContain('Missing docs');
  });

  it('requires lender-useful packet sections before marking ready', () => {
    const result = calculateReadinessResult(sampleReadinessIntake);
    const packet = buildFinancingPacket(sampleReadinessIntake, result);
    const missing = buildFinancingPacket({ ...sampleReadinessIntake, billUploadFileName: '' }, result);

    expect(packet.status).toBe('ready_for_lender');
    expect(packet.riskFlags).toContain('Net-metering still requires utility confirmation.');
    expect(missing.status).toBe('missing_requirements');
    expect(missing.missingRequirements).toContain('Customer bill upload');
    expect(missing.missingRequirements).not.toContain('Roof photo upload');
  });

  it('only hard-removes untouched captured leads', () => {
    expect(canRemoveLead({ stage: 'captured', hasOperationalRecords: false }).allowed).toBe(true);
    expect(canRemoveLead({ stage: 'captured', hasOperationalRecords: true }).allowed).toBe(false);
    expect(canRemoveLead({ stage: 'survey_assigned', hasOperationalRecords: false }).allowed).toBe(false);
  });
});
