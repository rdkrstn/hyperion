import { handleCors } from '../_shared/cors.ts';
import { ApiError, jsonError, jsonOk, readJson, requireString } from '../_shared/errors.ts';

export type DocumentValidateOps = {
  validateDocument: (input: { fileId: string; action: 'validate' | 'reject'; reviewerId: string; notes?: string }) => Promise<{ file_id: string; status: string; readiness: unknown }>;
};

export function createDocumentValidateHandler(ops: DocumentValidateOps) {
  return async function handleDocumentValidate(request: Request) {
    const cors = handleCors(request);
    if (cors) return cors;
    if (request.method !== 'POST') return jsonError(new ApiError('method_not_allowed', 'Method not allowed.', 405));
    try {
      const input = await readJson<{ file_id?: string; fileId?: string; action?: 'validate' | 'reject'; reviewer_id?: string; reviewerId?: string; notes?: string }>(request);
      const action = input.action;
      if (action !== 'validate' && action !== 'reject') throw new ApiError('bad_request', 'action must be validate or reject.');
      return jsonOk(await ops.validateDocument({
        fileId: requireString(input.file_id ?? input.fileId, 'file_id'),
        action,
        reviewerId: requireString(input.reviewer_id ?? input.reviewerId, 'reviewer_id'),
        notes: input.notes,
      }));
    } catch (error) {
      return jsonError(error);
    }
  };
}
