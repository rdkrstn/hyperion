import { handleCors } from '../_shared/cors.ts';
import { ApiError, jsonError, jsonOk, readJson, requireString } from '../_shared/errors.ts';

export type SurveyEvidenceUploadOps = {
  recordEvidence: (input: { surveyId: string; category: string; fileName: string; mimeType: string; base64?: string; isStructurallySound?: boolean }) => Promise<{ evidence_id: string; validation_status: string }>;
};

export function createSurveyEvidenceUploadHandler(ops: SurveyEvidenceUploadOps) {
  return async function handleSurveyEvidenceUpload(request: Request) {
    const cors = handleCors(request);
    if (cors) return cors;
    if (request.method !== 'POST') return jsonError(new ApiError('method_not_allowed', 'Method not allowed.', 405));
    try {
      const input = await readJson<{ survey_id?: string; surveyId?: string; category?: string; fileName?: string; file_name?: string; mimeType?: string; mime_type?: string; base64?: string; is_structurally_sound?: boolean; isStructurallySound?: boolean }>(request);
      return jsonOk(await ops.recordEvidence({
        surveyId: requireString(input.survey_id ?? input.surveyId, 'survey_id'),
        category: requireString(input.category, 'category'),
        fileName: requireString(input.fileName ?? input.file_name, 'fileName'),
        mimeType: String(input.mimeType ?? input.mime_type ?? 'image/jpeg'),
        base64: input.base64,
        isStructurallySound: input.is_structurally_sound ?? input.isStructurallySound,
      }));
    } catch (error) {
      return jsonError(error);
    }
  };
}
