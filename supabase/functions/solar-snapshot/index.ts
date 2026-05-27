import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { normalizeSolarInsights } from '../_shared/google.ts';
import { recalculateLeadReadiness } from '../_shared/readiness.ts';
import { logTimeline } from '../_shared/timeline.ts';
import { createSolarSnapshotHandler } from './handler.ts';

const supabase = createSupabaseAdmin();
const googleMapsServerKey = Deno.env.get('GOOGLE_MAPS_SERVER_KEY');

Deno.serve(createSolarSnapshotHandler({
  async createOrUpdateSnapshot(input) {
    let normalized;
    if (!googleMapsServerKey) {
      normalized = {
        roof_capacity_kwp: 0,
        max_panels: 0,
        panel_capacity_watts: 580,
        selected_panel_count: 0,
        selected_system_size_kwp: 0,
        annual_production_kwh: 0,
        max_annual_production_kwh: 0,
        imagery_quality: 'UNKNOWN',
        roof_area_m2: 0,
        sunshine_hours_per_year: 0,
        carbon_offset_factor_kg_per_mwh: 0,
        imagery_date: undefined,
        imagery_processed_date: undefined,
        bounding_box: {},
        building_center: { latitude: input.lat, longitude: input.lng },
        roof_segments: [],
        panel_placements: [],
        data_layer_state: {
          status: 'unavailable',
          reason: 'GOOGLE_MAPS_SERVER_KEY is not configured.',
        },
        pitch: undefined,
        azimuth: undefined,
        risk_flags: ['GOOGLE_MAPS_SERVER_KEY is not configured.'],
        dispatch_gate: 'manual_override_required',
        recommended_next_action: 'Request owner/manager manual dispatch override.',
        raw_payload: {},
      };
    } else {
      const url = new URL('https://solar.googleapis.com/v1/buildingInsights:findClosest');
      url.searchParams.set('location.latitude', String(input.lat));
      url.searchParams.set('location.longitude', String(input.lng));
      url.searchParams.set('requiredQuality', 'MEDIUM');
      url.searchParams.set('key', googleMapsServerKey);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Google Solar API returned ${response.status}.`);
      normalized = normalizeSolarInsights(await response.json());
    }
    const row = {
      lead_id: input.leadId,
      deal_id: input.dealId,
      latitude: input.lat,
      longitude: input.lng,
      ...normalized,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const existingQuery = supabase
      .from('solar_snapshots')
      .select('id')
      .eq('lead_id', input.leadId)
      .limit(1);
    const { data: existing, error: existingError } = input.dealId
      ? await existingQuery.eq('deal_id', input.dealId).maybeSingle()
      : await existingQuery.is('deal_id', null).maybeSingle();
    if (existingError) throw existingError;
    const { data: snapshot, error } = existing
      ? await supabase.from('solar_snapshots').update(row).eq('id', existing.id).select('id').single()
      : await supabase.from('solar_snapshots').insert(row).select('id').single();
    if (error) throw error;
    if (input.dealId) {
      const { error: dealError } = await supabase.from('deals').update({
        stage: normalized.dispatch_gate === 'ready' ? 'solar_snapshot_reviewed' : 'deal_created',
        next_best_action: normalized.recommended_next_action,
        blocker: normalized.risk_flags[0],
        updated_at: new Date().toISOString(),
      }).eq('id', input.dealId);
      if (dealError) throw dealError;
    }
    await logTimeline(supabase, {
      ownerType: input.dealId ? 'deal' : 'lead',
      ownerId: input.dealId ?? input.leadId,
      leadId: input.leadId,
      dealId: input.dealId,
      title: 'Solar Snapshot reviewed',
      description: normalized.recommended_next_action,
      actorRole: 'system',
    });
    return {
      roof_capacity_kwp: normalized.roof_capacity_kwp,
      max_panels: normalized.max_panels,
      annual_production_kwh: normalized.annual_production_kwh,
      max_annual_production_kwh: normalized.max_annual_production_kwh,
      selected_panel_count: normalized.selected_panel_count,
      selected_system_size_kwp: normalized.selected_system_size_kwp,
      roof_area_m2: normalized.roof_area_m2,
      sunshine_hours_per_year: normalized.sunshine_hours_per_year,
      imagery_quality: normalized.imagery_quality,
      dispatch_gate: normalized.dispatch_gate,
      recommended_next_action: normalized.recommended_next_action,
      snapshot_id: snapshot.id,
    };
  },
  recalculateReadiness: (leadId) => recalculateLeadReadiness(supabase, leadId),
}));
