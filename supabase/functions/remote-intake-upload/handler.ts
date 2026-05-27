import { handleCors } from '../_shared/cors.ts';
import { ApiError, jsonError, jsonOk, readJson, requireString } from '../_shared/errors.ts';

export type RemoteIntakeUploadOps = {
  recordUpload: (input: { token: string; accessJwt: string; category: string; fileName: string; mimeType: string; base64?: string }) => Promise<{
    document_id: string;
    status: 'uploaded' | 'needs_review';
    triggered_ocr: boolean;
  }>;
};

export function createRemoteIntakeUploadHandler(ops: RemoteIntakeUploadOps) {
  return async function handleRemoteIntakeUpload(request: Request) {
    const cors = handleCors(request);
    if (cors) return cors;
    if (request.method !== 'POST') return jsonError(new ApiError('method_not_allowed', 'Method not allowed.', 405));
    try {
      const input = await readJson<{ token?: string; accessJwt?: string; access_jwt?: string; category?: string; fileName?: string; file_name?: string; mimeType?: string; mime_type?: string; base64?: string }>(request);
      return jsonOk(await ops.recordUpload({
        token: requireString(input.token, 'token'),
        accessJwt: requireString(input.accessJwt ?? input.access_jwt, 'accessJwt'),
        category: requireString(input.category, 'category'),
        fileName: requireString(input.fileName ?? input.file_name, 'fileName'),
        mimeType: String(input.mimeType ?? input.mime_type ?? 'application/octet-stream'),
        base64: input.base64,
      }));
    } catch (error) {
      return jsonError(error);
    }
  };
}
