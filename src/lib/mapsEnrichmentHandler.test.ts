import { describe, expect, it } from 'vitest';
import { createMapsEnrichmentHandler, type MapsEnrichmentOps } from '../../supabase/functions/maps-enrichment/handler';

describe('maps enrichment Edge Function handler', () => {
  it('normalizes address or pin data without calling Solar API', async () => {
    const ops: MapsEnrichmentOps = {
      normalizeLocation: async () => ({
        status: 'maps_pending',
        formatted_address: 'Manual pin pending',
        lat: 14.55,
        lng: 121.02,
        place_id: 'manual',
      }),
    };
    const response = await createMapsEnrichmentHandler(ops)(new Request('https://functions.local/maps-enrichment', {
      method: 'POST',
      body: JSON.stringify({ lead_id: 'lead-001', lat: 14.55, lng: 121.02 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe('maps_pending');
  });
});
