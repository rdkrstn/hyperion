import { handleCors } from '../_shared/cors.ts';
import { ApiError, jsonError, jsonOk, readJson, requireString } from '../_shared/errors.ts';

export type SurveyDispatchOps = {
  dispatchSurvey: (input: { dealId?: string; leadId?: string; installerId: string; schedule: string; location: string }) => Promise<{ survey_id: string; calendar_event_id: string }>;
};

export function createSurveyDispatchHandler(ops: SurveyDispatchOps) {
  return async function handleSurveyDispatch(request: Request) {
    const cors = handleCors(request);
    if (cors) return cors;
    if (request.method !== 'POST') return jsonError(new ApiError('method_not_allowed', 'Method not allowed.', 405));
    try {
      const input = await readJson<{ deal_id?: string; dealId?: string; lead_id?: string; leadId?: string; installer_id?: string; installerId?: string; schedule?: string; location?: string }>(request);
      if (!input.deal_id && !input.dealId && !input.lead_id && !input.leadId) throw new ApiError('bad_request', 'deal_id or lead_id is required.');
      return jsonOk(await ops.dispatchSurvey({
        dealId: input.deal_id ?? input.dealId,
        leadId: input.lead_id ?? input.leadId,
        installerId: requireString(input.installer_id ?? input.installerId, 'installer_id'),
        schedule: requireString(input.schedule, 'schedule'),
        location: requireString(input.location, 'location'),
      }));
    } catch (error) {
      return jsonError(error);
    }
  };
}
