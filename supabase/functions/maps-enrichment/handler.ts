import { handleCors } from '../_shared/cors.ts';
import { ApiError, jsonError, jsonOk, readJson, requireString } from '../_shared/errors.ts';

export type MapsEnrichmentOps = {
  normalizeLocation: (input: { leadId: string; address?: string; placeId?: string; lat?: number; lng?: number }) => Promise<{
    formatted_address: string;
    lat: number;
    lng: number;
    place_id?: string;
    status: 'ready' | 'maps_pending';
  }>;
};

export function createMapsEnrichmentHandler(ops: MapsEnrichmentOps) {
  return async function handleMapsEnrichment(request: Request) {
    const cors = handleCors(request);
    if (cors) return cors;
    if (request.method !== 'POST') return jsonError(new ApiError('method_not_allowed', 'Method not allowed.', 405));
    try {
      const input = await readJson<{ lead_id?: string; leadId?: string; address?: string; place_id?: string; placeId?: string; lat?: number; lng?: number; latitude?: number; longitude?: number }>(request);
      const leadId = requireString(input.lead_id ?? input.leadId, 'lead_id');
      const result = await ops.normalizeLocation({
        leadId,
        address: input.address,
        placeId: input.place_id ?? input.placeId,
        lat: input.lat ?? input.latitude,
        lng: input.lng ?? input.longitude,
      });
      return jsonOk(result);
    } catch (error) {
      return jsonError(error);
    }
  };
}
