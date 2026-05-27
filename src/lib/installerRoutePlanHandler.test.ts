import { describe, expect, it } from 'vitest';
import { createInstallerRoutePlanHandler, type InstallerRoutePlanOps } from '../../supabase/functions/installer-route-plan/handler';

describe('installer route plan Edge Function handler', () => {
  it('returns an optimized route plan from the injected route provider', async () => {
    const ops: InstallerRoutePlanOps = {
      buildRoutePlan: async () => ({
        id: 'route-1',
        installerId: 'installer-1',
        status: 'ready',
        origin: { latitude: 14.55, longitude: 121.02 },
        orderedStops: [{ dealId: 'lead-1', surveyJobId: 'survey-1', label: 'First', latitude: 14.56, longitude: 121.03, durationMinutes: 12, distanceKm: 3 }],
        createdAt: 'now',
      }),
    };
    const response = await createInstallerRoutePlanHandler(ops)(new Request('https://functions.local/installer-route-plan', {
      method: 'POST',
      body: JSON.stringify({ installerId: 'installer-1' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.orderedStops[0].dealId).toBe('lead-1');
  });
});
