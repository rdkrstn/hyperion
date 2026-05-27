import { ApiError } from '../_shared/errors.ts';
import { assertRole, loadStaffProfile } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { safeStoragePath, uploadPrivateObject } from '../_shared/storage.ts';
import { logTimeline } from '../_shared/timeline.ts';
import { createSurveyEvidenceUploadHandler } from './handler.ts';

const supabase = createSupabaseAdmin();
const requiredEvidence = ['main_breaker_panel', 'roof_surface', 'inverter_location', 'wire_run_path'];

function decodeBase64(base64: string) {
  const binary = atob(base64.includes(',') ? base64.split(',').pop() ?? '' : base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

Deno.serve(async (request) => {
  const profile = request.method === 'OPTIONS'
    ? undefined
    : await loadStaffProfile(supabase, request.headers.get('authorization'));
  if (profile) assertRole(profile.role, ['installer']);

  return createSurveyEvidenceUploadHandler({
    async recordEvidence({ surveyId, category, fileName, mimeType, base64, isStructurallySound }) {
      if (!profile) throw new ApiError('forbidden', 'Installer profile is required.', 403);
      if (!base64) throw new ApiError('bad_request', 'base64 file payload is required.', 400);

      const { data: survey, error: surveyError } = await supabase
        .from('surveys')
        .select('id,lead_id,deal_id,installer_id,is_structurally_sound')
        .eq('id', surveyId)
        .maybeSingle();
      if (surveyError) throw surveyError;
      if (!survey) throw new ApiError('not_found', 'Survey not found.', 404);
      if (survey.installer_id !== profile.id) throw new ApiError('forbidden', 'Only the assigned installer can upload survey evidence.', 403);

      const safeFileName = fileName.replace(/[^\w.\-]+/g, '_');
      const storagePath = safeStoragePath(surveyId, category, `${crypto.randomUUID()}-${safeFileName}`);
      await uploadPrivateObject(supabase, 'survey-evidence', storagePath, decodeBase64(base64), mimeType);

      const { data: evidence, error: evidenceError } = await supabase.from('survey_evidence').upsert({
        survey_id: surveyId,
        category,
        file_name: safeFileName,
        mime_type: mimeType,
        bucket: 'survey-evidence',
        storage_path: storagePath,
        uploaded_by: profile.id,
        uploaded_at: new Date().toISOString(),
      }, { onConflict: 'survey_id,category' }).select('id').single();
      if (evidenceError) throw evidenceError;

      if (typeof isStructurallySound === 'boolean') {
        const { error } = await supabase.from('surveys').update({
          is_structurally_sound: isStructurallySound,
          updated_at: new Date().toISOString(),
        }).eq('id', surveyId);
        if (error) throw error;
      }

      const { data: uploaded, error: uploadedError } = await supabase
        .from('survey_evidence')
        .select('category')
        .eq('survey_id', surveyId);
      if (uploadedError) throw uploadedError;
      const uploadedCategories = new Set((uploaded ?? []).map((row: { category: string }) => row.category));
      const soundness = typeof isStructurallySound === 'boolean' ? isStructurallySound : survey.is_structurally_sound;
      const missing = requiredEvidence.filter((required) => !uploadedCategories.has(required));
      const validationStatus = soundness === false
        ? 'blocked'
        : missing.length === 0 && soundness === true
          ? 'validated'
          : 'evidence_pending';

      const responses = await Promise.all([
        supabase.from('surveys').update({
          validation_status: validationStatus,
          blockers: validationStatus === 'blocked'
            ? ['Roof requires engineering remediation plan before proceeding.']
            : missing.map((item) => `${item.replaceAll('_', ' ')} is missing.`),
          updated_at: new Date().toISOString(),
        }).eq('id', surveyId),
        validationStatus === 'validated'
          ? supabase.from('deals').update({
            stage: 'survey_validated',
            survey_status: 'validated',
            next_best_action: 'Build proposal from validated survey and documents.',
            updated_at: new Date().toISOString(),
          }).eq('id', survey.deal_id)
          : Promise.resolve({ error: null }),
      ]);
      const failed = responses.find((response) => response.error);
      if (failed?.error) throw failed.error;

      await logTimeline(supabase, {
        ownerType: 'survey',
        ownerId: surveyId,
        leadId: survey.lead_id,
        dealId: survey.deal_id,
        surveyId,
        title: validationStatus === 'validated' ? 'Survey validated' : 'Survey evidence uploaded',
        description: `${category.replaceAll('_', ' ')} uploaded. Status: ${validationStatus}.`,
        actorRole: profile.role,
      });

      return {
        evidence_id: evidence.id,
        validation_status: validationStatus,
      };
    },
  })(request);
});
