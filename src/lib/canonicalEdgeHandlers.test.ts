import { describe, expect, it } from 'vitest';
import { createDocumentValidateHandler } from '../../supabase/functions/document-validate/handler';
import { createGenerateProposalHandler } from '../../supabase/functions/generate-proposal/handler';
import { createReadinessScoreHandler } from '../../supabase/functions/readiness-score/handler';
import { createRemoteIntakeCreateHandler } from '../../supabase/functions/remote-intake-create/handler';
import { createRemoteIntakeUploadHandler } from '../../supabase/functions/remote-intake-upload/handler';
import { createSolarSnapshotHandler } from '../../supabase/functions/solar-snapshot/handler';
import { createSurveyDispatchHandler } from '../../supabase/functions/survey-dispatch/handler';
import { createSurveyEvidenceUploadHandler } from '../../supabase/functions/survey-evidence-upload/handler';

describe('canonical Edge Function handlers', () => {
  it('creates solar snapshots through the server-owned Solar API mutation', async () => {
    const handler = createSolarSnapshotHandler({
      createOrUpdateSnapshot: async () => ({
        roof_capacity_kwp: 12,
        max_panels: 30,
        annual_production_kwh: 16800,
        imagery_quality: 'HIGH',
        dispatch_gate: 'ready',
        recommended_next_action: 'Schedule survey.',
      }),
      recalculateReadiness: async () => undefined,
    });
    const response = await handler(new Request('http://local/solar-snapshot', {
      method: 'POST',
      body: JSON.stringify({ lead_id: 'lead-1', lat: 14.55, lng: 121.02 }),
    }));
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.data.dispatch_gate).toBe('ready');
  });

  it('exposes dedicated handlers for readiness, remote intake, documents, surveys, and proposals', async () => {
    const readiness = await createReadinessScoreHandler({
      recalculateReadiness: async () => ({ score: 80, status: 'qualified', blockers: [], next_best_action: 'Create deal.' }),
    })(new Request('http://local/readiness-score', { method: 'POST', body: JSON.stringify({ lead_id: 'lead-1' }) }));

    const remoteCreate = await createRemoteIntakeCreateHandler({
      createRemoteIntake: async () => ({ token: 'token', access_jwt: 'jwt', remote_intake_url: 'http://local/remote-intake/token', expires_at: '2026-05-24T00:00:00Z' }),
    })(new Request('http://local/remote-intake-create', { method: 'POST', body: JSON.stringify({ lead_id: 'lead-1' }) }));

    const remoteUpload = await createRemoteIntakeUploadHandler({
      recordUpload: async () => ({ document_id: 'doc-1', status: 'needs_review', triggered_ocr: true }),
    })(new Request('http://local/remote-intake-upload', { method: 'POST', body: JSON.stringify({ token: 'token', accessJwt: 'jwt', category: 'customer_bill', fileName: 'bill.jpg' }) }));

    const docValidate = await createDocumentValidateHandler({
      validateDocument: async () => ({ file_id: 'doc-1', status: 'validated', readiness: { score: 90 } }),
    })(new Request('http://local/document-validate', { method: 'POST', body: JSON.stringify({ file_id: 'doc-1', action: 'validate', reviewer_id: 'cs-1' }) }));

    const surveyDispatch = await createSurveyDispatchHandler({
      dispatchSurvey: async () => ({ survey_id: 'survey-1', calendar_event_id: 'cal-1' }),
    })(new Request('http://local/survey-dispatch', { method: 'POST', body: JSON.stringify({ deal_id: 'deal-1', installer_id: 'installer-1', schedule: '2026-05-25T09:00:00Z', location: 'Makati' }) }));

    const evidence = await createSurveyEvidenceUploadHandler({
      recordEvidence: async () => ({ evidence_id: 'evidence-1', validation_status: 'evidence_pending' }),
    })(new Request('http://local/survey-evidence-upload', { method: 'POST', body: JSON.stringify({ survey_id: 'survey-1', category: 'roof_surface', fileName: 'roof.jpg' }) }));

    const proposal = await createGenerateProposalHandler({
      generateProposal: async () => ({ proposal_id: 'proposal-1', status: 'frozen', subtotal: 800000, gross_margin_percent: 32 }),
    })(new Request('http://local/generate-proposal', { method: 'POST', body: JSON.stringify({ deal_id: 'deal-1', system_size_kwp: 10 }) }));

    for (const response of [readiness, remoteCreate, remoteUpload, docValidate, surveyDispatch, evidence, proposal]) {
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
    }
  });
});
