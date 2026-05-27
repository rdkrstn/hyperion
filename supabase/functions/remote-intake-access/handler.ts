import { handleCors } from '../_shared/cors.ts';
import { ApiError, jsonError, jsonOk, requireString } from '../_shared/errors.ts';

export type RemoteIntakeAccessOps = {
  loadPublicPayload: (input: { token: string; accessJwt: string }) => Promise<{
    lead_id: string;
    deal_id?: string;
    token: string;
    status: string;
    expires_at: string;
    required_uploads: string[];
    uploads: Array<{ category: string; file_name: string; uploaded_at: string }>;
  }>;
};

export function createRemoteIntakeAccessHandler(ops: RemoteIntakeAccessOps) {
  return async function handleRemoteIntakeAccess(request: Request) {
    const cors = handleCors(request);
    if (cors) return cors;
    if (request.method !== 'GET') return jsonError(new ApiError('method_not_allowed', 'Remote intake access is GET-only.', 405));
    try {
      const url = new URL(request.url);
      const token = requireString(url.searchParams.get('token'), 'token');
      const accessJwt = requireString(url.searchParams.get('access_jwt') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''), 'access_jwt');
      return jsonOk(await ops.loadPublicPayload({ token, accessJwt }));
    } catch (error) {
      return jsonError(error);
    }
  };
}
