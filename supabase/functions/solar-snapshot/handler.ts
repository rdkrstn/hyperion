import { handleCors } from '../_shared/cors.ts';
import { ApiError, jsonError, jsonOk, readJson, requireNumber, requireString } from '../_shared/errors.ts';

export type SolarSnapshotOps = {
  createOrUpdateSnapshot: (input: { leadId: string; lat: number; lng: number; dealId?: string }) => Promise<{
    roof_capacity_kwp: number;
    max_panels: number;
    annual_production_kwh: number;
    imagery_quality: string;
    dispatch_gate: string;
    recommended_next_action: string;
    roof_area_m2?: number;
    sunshine_hours_per_year?: number;
    selected_panel_count?: number;
    selected_system_size_kwp?: number;
    max_annual_production_kwh?: number;
  }>;
  recalculateReadiness: (leadId: string) => Promise<unknown>;
};

export function createSolarSnapshotHandler(ops: SolarSnapshotOps) {
  return async function handleSolarSnapshot(request: Request) {
    const cors = handleCors(request);
    if (cors) return cors;
    if (request.method !== 'POST') return jsonError(new ApiError('method_not_allowed', 'Method not allowed.', 405));
    try {
      const input = await readJson<{ lead_id?: string; leadId?: string; deal_id?: string; dealId?: string; lat?: number; lng?: number; latitude?: number; longitude?: number }>(request);
      const leadId = requireString(input.lead_id ?? input.leadId, 'lead_id');
      const lat = requireNumber(input.lat ?? input.latitude, 'lat');
      const lng = requireNumber(input.lng ?? input.longitude, 'lng');
      const data = await ops.createOrUpdateSnapshot({ leadId, dealId: input.deal_id ?? input.dealId, lat, lng });
      await ops.recalculateReadiness(leadId);
      return jsonOk(data);
    } catch (error) {
      return jsonError(error);
    }
  };
}
