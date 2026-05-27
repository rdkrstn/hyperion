import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { logTimeline } from '../_shared/timeline.ts';
import { createMapsEnrichmentHandler } from './handler.ts';

const supabase = createSupabaseAdmin();
const googleMapsServerKey = Deno.env.get('GOOGLE_MAPS_SERVER_KEY');

async function geocode(input: { address?: string; placeId?: string; lat?: number; lng?: number }) {
  if (!googleMapsServerKey) {
    return {
      formatted_address: input.address ?? 'Manual review required',
      lat: Number(input.lat ?? 0),
      lng: Number(input.lng ?? 0),
      place_id: input.placeId,
      status: 'maps_pending' as const,
    };
  }
  if (input.lat !== undefined && input.lng !== undefined) {
    return {
      formatted_address: input.address ?? 'Confirmed pin',
      lat: input.lat,
      lng: input.lng,
      place_id: input.placeId,
      status: 'ready' as const,
    };
  }
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  if (input.placeId) url.searchParams.set('place_id', input.placeId);
  else url.searchParams.set('address', input.address ?? '');
  url.searchParams.set('key', googleMapsServerKey);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Maps returned ${response.status}.`);
  const body = await response.json();
  const result = body.results?.[0];
  return {
    formatted_address: result?.formatted_address ?? input.address ?? 'Manual review required',
    lat: Number(result?.geometry?.location?.lat ?? 0),
    lng: Number(result?.geometry?.location?.lng ?? 0),
    place_id: result?.place_id ?? input.placeId,
    status: result ? 'ready' as const : 'maps_pending' as const,
  };
}

Deno.serve(createMapsEnrichmentHandler({
  async normalizeLocation(input) {
    const result = await geocode(input);
    const { error } = await supabase.from('lead_site_profiles').update({
      formatted_address: result.formatted_address,
      place_id: result.place_id,
      latitude: result.lat,
      longitude: result.lng,
      maps_status: result.status,
      updated_at: new Date().toISOString(),
    }).eq('lead_id', input.leadId);
    if (error) throw error;
    await logTimeline(supabase, {
      ownerType: 'lead',
      ownerId: input.leadId,
      leadId: input.leadId,
      title: 'Location normalized',
      description: result.formatted_address,
      actorRole: 'system',
    });
    return result;
  },
}));
