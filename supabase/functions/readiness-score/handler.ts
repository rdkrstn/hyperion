import { handleCors } from '../_shared/cors.ts';
import { ApiError, jsonError, jsonOk, readJson, requireString } from '../_shared/errors.ts';

export type ReadinessScoreOps = {
  recalculateReadiness: (leadId: string) => Promise<{ score: number; status: string; blockers: string[]; next_best_action: string }>;
};

export function createReadinessScoreHandler(ops: ReadinessScoreOps) {
  return async function handleReadinessScore(request: Request) {
    const cors = handleCors(request);
    if (cors) return cors;
    if (request.method !== 'POST') return jsonError(new ApiError('method_not_allowed', 'Method not allowed.', 405));
    try {
      const input = await readJson<{ lead_id?: string; leadId?: string }>(request);
      return jsonOk(await ops.recalculateReadiness(requireString(input.lead_id ?? input.leadId, 'lead_id')));
    } catch (error) {
      return jsonError(error);
    }
  };
}
