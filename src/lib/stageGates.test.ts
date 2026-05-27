import { describe, expect, it } from 'vitest';
import { canAdvanceStage, nextRequiredAction } from './stageGates';
import { seedDeals } from '../data/seed';
import { buildFinancingPacket, buildNetMeteringWorkflow, calculateReadinessResult, sampleReadinessIntake } from './readiness';

describe('stage gates', () => {
  it('blocks survey assignment until pre-audit is complete and qualified', () => {
    const captured = seedDeals[0];

    expect(canAdvanceStage(captured, 'survey_assigned').allowed).toBe(false);
    expect(nextRequiredAction(captured)).toContain('Run pre-audit');
  });

  it('blocks proposal until survey completion and owner review until CS readiness', () => {
    const assigned = seedDeals[1];
    const proposalReady = seedDeals[3];

    expect(canAdvanceStage(assigned, 'proposal_ready').allowed).toBe(false);
    expect(canAdvanceStage(proposalReady, 'owner_review').allowed).toBe(false);
  });

  it('blocks CS review until contract is signed and mocked billing exists', () => {
    const awaitingSignature = seedDeals[3];

    expect(canAdvanceStage(awaitingSignature, 'cs_review').allowed).toBe(false);
    expect(canAdvanceStage(awaitingSignature, 'cs_review').reason).toContain('Typed contract acceptance');
  });

  it('blocks proposal generation until installer validates the completed survey', () => {
    const surveyed = {
      ...seedDeals[2],
      surveyApproval: { ...seedDeals[2].surveyApproval!, status: 'pending_uploads' as const },
    };

    expect(canAdvanceStage(surveyed, 'proposal_ready').allowed).toBe(false);
    expect(canAdvanceStage(surveyed, 'proposal_ready').reason).toContain('Installer');
    expect(nextRequiredAction(surveyed)).toContain('installer validation');
  });

  it('allows proposal generation after installer survey validation', () => {
    const surveyed = {
      ...seedDeals[2],
      surveyApproval: { ...seedDeals[2].surveyApproval!, status: 'installer_validated' as const },
    };

    expect(canAdvanceStage(surveyed, 'proposal_ready').allowed).toBe(false);
    expect(canAdvanceStage(surveyed, 'proposal_ready').reason).toContain('checkout estimate');
  });

  it('treats legacy CS or owner survey validation as migrated installer validation', () => {
    const legacyValidated = {
      ...seedDeals[2],
      surveyApproval: { ...seedDeals[2].surveyApproval!, status: 'cs_validated' as const },
    };

    expect(canAdvanceStage(legacyValidated, 'proposal_ready').reason).toContain('checkout estimate');
  });

  it('blocks proposal generation until net-metering documents and technical review are ready', () => {
    const intake = { ...sampleReadinessIntake, billUploadFileName: '' };
    const readinessResult = calculateReadinessResult(intake);
    const surveyed = {
      ...seedDeals[2],
      readinessIntake: intake,
      readinessResult,
      readinessUploads: [],
      financingPacket: buildFinancingPacket(intake, readinessResult),
      netMeteringWorkflow: buildNetMeteringWorkflow(intake, readinessResult.recommendedSystemSizeKwp),
    };

    expect(canAdvanceStage(surveyed, 'proposal_ready').allowed).toBe(false);
    expect(canAdvanceStage(surveyed, 'proposal_ready').reason).toContain('net-metering');
    expect(nextRequiredAction(surveyed)).toContain('net-metering');
  });

  it('allows owner approval only after CS review is complete', () => {
    const csReady = seedDeals[4];

    expect(canAdvanceStage(csReady, 'owner_review').allowed).toBe(true);
    expect(canAdvanceStage({ ...csReady, stage: 'owner_review' }, 'approved').allowed).toBe(true);
  });
});
