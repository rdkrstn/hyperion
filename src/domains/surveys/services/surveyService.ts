import { makeId, nowIso } from '../../../shared/types/app';
import type { DealRecord } from '../../deals/types';
import type { SurveyEvidenceCategory, SurveyRecord } from '../types';

export const requiredSurveyEvidence: SurveyEvidenceCategory[] = ['main_breaker_panel', 'roof_surface', 'inverter_location', 'wire_run_path'];

export function scheduleSurvey(deal: DealRecord, input: { installerId: string; scheduledAt: string; location: string; accessInstructions?: string }): SurveyRecord {
  if (!input.installerId.trim()) throw new Error('Installer is required');
  if (!input.scheduledAt.trim()) throw new Error('Survey schedule is required');
  if (!input.location.trim()) throw new Error('Survey location is required');
  const createdAt = nowIso();
  return {
    id: makeId('survey'),
    leadId: deal.leadId,
    dealId: deal.id,
    installerId: input.installerId,
    scheduledAt: input.scheduledAt,
    location: input.location,
    accessInstructions: input.accessInstructions,
    evidenceUploads: [],
    findings: { safetyRisks: [] },
    validationOutcome: 'scheduled',
    blockers: ['Upload required survey evidence.'],
    createdAt,
    updatedAt: createdAt,
  };
}

export function addSurveyEvidence(survey: SurveyRecord, input: { category: SurveyEvidenceCategory; fileName: string; mimeType: string; storagePath: string; previewUrl?: string }): SurveyRecord {
  const upload = {
    id: makeId('evidence'),
    surveyId: survey.id,
    uploadedAt: nowIso(),
    ...input,
  };
  const evidenceUploads = [upload, ...survey.evidenceUploads.filter((item) => item.category !== input.category)];
  return {
    ...survey,
    evidenceUploads,
    validationOutcome: 'evidence_pending',
    blockers: surveyValidationGate({ ...survey, evidenceUploads }).missing,
    updatedAt: nowIso(),
  };
}

export function surveyValidationGate(survey: SurveyRecord) {
  const uploaded = new Set(survey.evidenceUploads.map((upload) => upload.category));
  const missing = requiredSurveyEvidence.filter((category) => !uploaded.has(category));
  if (survey.isStructurallySound === false) {
    return {
      allowed: false,
      missing: ['engineering remediation plan'],
      reason: 'Survey Blocked: Roof requires engineering remediation plan before proceeding.',
    };
  }
  if (survey.isStructurallySound === undefined) {
    return { allowed: false, missing: [...missing, 'roof structural soundness answer'], reason: 'Answer roof structural soundness before completing survey.' };
  }
  if (missing.length) {
    return { allowed: false, missing, reason: `Upload required evidence: ${missing.join(', ')}` };
  }
  return { allowed: true, missing: [], reason: 'Survey evidence and structural soundness are complete.' };
}

export function validateSurvey(survey: SurveyRecord): SurveyRecord {
  const gate = surveyValidationGate(survey);
  if (!gate.allowed) throw new Error(gate.reason);
  return {
    ...survey,
    validationOutcome: 'validated',
    blockers: [],
    findings: {
      ...survey.findings,
      roofCondition: survey.findings.roofCondition ?? 'Structurally sound',
    },
    updatedAt: nowIso(),
  };
}
