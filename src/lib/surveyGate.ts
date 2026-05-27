import { requiredSurveyUploadCategories, surveyEvidenceRequirements } from './coreOps';
import type { InstallerValidationPayload, Role, SurveyGateResult, SurveyUpload } from '../types';

function labelFor(category: string) {
  return surveyEvidenceRequirements.find((requirement) => requirement.category === category)?.label
    ?? category.replaceAll('_', ' ');
}

export function evaluateSurveyGate(
  uploads: SurveyUpload[],
  actorRole: Role,
  roofStructurallySound?: boolean | null,
): SurveyGateResult {
  if (actorRole !== 'installer') {
    return {
      allowed: false,
      reason: 'Installer must complete survey validation.',
      severity: 'error',
      missingEvidence: [],
    };
  }

  const uploaded = new Set(uploads.map((upload) => upload.category));
  const missingEvidence = requiredSurveyUploadCategories.filter((category) => !uploaded.has(category));
  if (missingEvidence.length) {
    return {
      allowed: false,
      reason: `Upload ${missingEvidence.map(labelFor).join(', ')} before completing the survey.`,
      severity: 'warning',
      missingEvidence,
    };
  }

  if (roofStructurallySound === undefined || roofStructurallySound === null) {
    return {
      allowed: false,
      reason: 'Answer roof structural soundness before survey completion.',
      severity: 'warning',
      missingEvidence: [],
    };
  }

  if (roofStructurallySound === false) {
    return {
      allowed: false,
      reason: 'Survey Blocked: Roof requires engineering remediation plan before proceeding.',
      severity: 'error',
      missingEvidence: [],
    };
  }

  return {
    allowed: true,
    reason: 'Installer evidence and roof validation are complete.',
    severity: 'info',
    missingEvidence: [],
  };
}

export function buildInstallerValidationPayload(uploads: SurveyUpload[], roofStructurallySound?: boolean | null): InstallerValidationPayload {
  const byCategory = new Map(uploads.map((upload) => [upload.category, upload.storagePath]));
  return {
    main_breaker_photo: byCategory.get('main_breaker_panel'),
    roof_surface_photo: byCategory.get('roof_surface'),
    inverter_location_photo: byCategory.get('inverter_location'),
    wire_run_path_photo: byCategory.get('wire_run_path'),
    is_structurally_sound: roofStructurallySound,
  };
}

export function installerValidationPayloadMeetsHardGate(payload?: InstallerValidationPayload) {
  const missing = [
    payload?.main_breaker_photo ? '' : 'Main breaker photo',
    payload?.roof_surface_photo ? '' : 'Roof surface photo',
    payload?.is_structurally_sound === true ? '' : 'Structurally sound roof confirmation',
  ].filter(Boolean);
  return {
    allowed: missing.length === 0,
    missing,
  };
}
