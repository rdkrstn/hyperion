import { handleCors } from '../_shared/cors.ts';
import { ApiError, jsonError, jsonOk, readJson, requireString } from '../_shared/errors.ts';

export type RemoteIntakeCreateOps = {
  createRemoteIntake: (input: { leadId: string; dealId?: string; requestedDocuments: string[]; origin: string }) => Promise<{
    token: string;
    access_jwt: string;
    remote_intake_url: string;
    expires_at: string;
  }>;
};

export function createRemoteIntakeCreateHandler(ops: RemoteIntakeCreateOps) {
  return async function handleRemoteIntakeCreate(request: Request) {
    const cors = handleCors(request);
    if (cors) return cors;
    if (request.method !== 'POST') return jsonError(new ApiError('method_not_allowed', 'Method not allowed.', 405));
    try {
      const input = await readJson<{ lead_id?: string; leadId?: string; deal_id?: string; dealId?: string; requested_documents?: string[]; requestedDocuments?: string[]; origin?: string }>(request);
      const leadId = requireString(input.lead_id ?? input.leadId, 'lead_id');
      const requestedDocuments = input.requested_documents ?? input.requestedDocuments ?? ['customer_bill', 'valid_id', 'site_control_document'];
      return jsonOk(await ops.createRemoteIntake({ leadId, dealId: input.deal_id ?? input.dealId, requestedDocuments, origin: input.origin ?? new URL(request.url).origin }));
    } catch (error) {
      return jsonError(error);
    }
  };
}
