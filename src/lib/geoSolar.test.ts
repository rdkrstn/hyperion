import { describe, expect, it } from 'vitest';
import { seedDeals } from '../data/seed';
import {
  applySolarCapacityCap,
  buildInstallerRoutePlan,
  buildMapsPendingSnapshot,
  normalizeSolarBuildingInsights,
} from './geoSolar';

describe('geo and solar enrichment', () => {
  it('marks records as maps pending when Google APIs are unavailable', () => {
    const snapshot = buildMapsPendingSnapshot(seedDeals[0], 'GOOGLE_MAPS_SERVER_KEY missing');

    expect(snapshot.geoPin.confidence).toBe('maps_pending');
    expect(snapshot.solarInsights?.status).toBe('maps_pending');
    expect(snapshot.solarInsights?.riskFlags).toContain('GOOGLE_MAPS_SERVER_KEY missing');
  });

  it('caps recommended kWp when Solar API roof maximum is lower than bill sizing', () => {
    const insights = normalizeSolarBuildingInsights({
      name: 'buildings/demo',
      imageryQuality: 'HIGH',
      solarPotential: {
        maxArrayPanelsCount: 18,
        panelCapacityWatts: 550,
        maxArrayAreaMeters2: 42,
        maxSunshineHoursPerYear: 1500,
        roofSegmentStats: [{ pitchDegrees: 12, azimuthDegrees: 180, stats: { areaMeters2: 42 } }],
        solarPanelConfigs: [{ panelsCount: 18, yearlyEnergyDcKwh: 13800 }],
      },
    });

    const capped = applySolarCapacityCap(14.5, insights);

    expect(insights.maxSystemSizeKwp).toBe(9.9);
    expect(capped.sizeKwp).toBe(9.9);
    expect(capped.capped).toBe(true);
  });

  it('orders installer jobs by route matrix duration', () => {
    const plan = buildInstallerRoutePlan({
      installerId: 'installer-001',
      origin: { latitude: 14.55, longitude: 121.02 },
      jobs: [
        { dealId: 'lead-a', surveyJobId: 'survey-a', label: 'A', latitude: 14.6, longitude: 121.01 },
        { dealId: 'lead-b', surveyJobId: 'survey-b', label: 'B', latitude: 14.5, longitude: 121.03 },
      ],
      matrix: [
        { dealId: 'lead-a', durationMinutes: 42, distanceKm: 14 },
        { dealId: 'lead-b', durationMinutes: 18, distanceKm: 5 },
      ],
    });

    expect(plan.status).toBe('ready');
    expect(plan.orderedStops.map((stop) => stop.dealId)).toEqual(['lead-b', 'lead-a']);
  });
});
