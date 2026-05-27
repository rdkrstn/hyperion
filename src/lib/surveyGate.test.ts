import { describe, expect, it } from 'vitest';
import { buildSurveyUpload, requiredSurveyUploadCategories } from './coreOps';
import { buildInstallerValidationPayload, evaluateSurveyGate, installerValidationPayloadMeetsHardGate } from './surveyGate';

const uploads = requiredSurveyUploadCategories.map((category) => buildSurveyUpload({
  surveyJobId: 'survey-001',
  category,
  fileName: `${category}.jpg`,
  storagePath: `survey-001/${category}.jpg`,
  uploadedByRole: 'installer',
}));

describe('survey gate view model', () => {
  it('blocks completion when roof remediation is required', () => {
    const gate = evaluateSurveyGate(uploads, 'installer', false);

    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain('engineering remediation plan');
    expect(gate.severity).toBe('error');
  });

  it('returns a human blocker for missing uploads', () => {
    const gate = evaluateSurveyGate(uploads.slice(0, -1), 'installer', true);

    expect(gate.allowed).toBe(false);
    expect(gate.missingEvidence.length).toBe(1);
    expect(gate.reason).toContain('Upload Wire Run Path');
  });

  it('builds the hard database payload from survey evidence and roof soundness', () => {
    const payload = buildInstallerValidationPayload(uploads, true);
    const gate = installerValidationPayloadMeetsHardGate(payload);
    const missing = installerValidationPayloadMeetsHardGate({
      main_breaker_photo: payload.main_breaker_photo,
      is_structurally_sound: true,
    });

    expect(gate.allowed).toBe(true);
    expect(missing.allowed).toBe(false);
    expect(missing.missing).toContain('Roof surface photo');
  });
});
