import { describe, expect, it } from 'vitest';
import { normalizeSolarInsights } from './google';

describe('Google Solar normalization', () => {
  it('stores Building Insights metrics, roof segments, panel placements, and raw payload', () => {
    const raw = {
      name: 'buildings/abc',
      center: { latitude: 10.816663, longitude: 122.542422 },
      imageryQuality: 'HIGH',
      imageryDate: { year: 2025, month: 12, day: 10 },
      solarPotential: {
        maxArrayPanelsCount: 67,
        panelCapacityWatts: 580,
        maxArrayAreaMeters2: 132,
        maxSunshineHoursPerYear: 1409,
        carbonOffsetFactorKgPerMwh: 551,
        wholeRoofStats: {
          areaMeters2: 132,
          sunshineQuantiles: [870, 1200, 1409],
        },
        roofSegmentStats: [
          {
            pitchDegrees: 16,
            azimuthDegrees: 182,
            stats: { areaMeters2: 64, sunshineQuantiles: [900, 1300, 1450] },
            center: { latitude: 10.8167, longitude: 122.5424 },
          },
        ],
        solarPanels: [
          {
            center: { latitude: 10.8167, longitude: 122.5424 },
            orientation: 'LANDSCAPE',
            segmentIndex: 0,
            yearlyEnergyDcKwh: 520,
          },
          {
            center: { latitude: 10.81671, longitude: 122.54241 },
            orientation: 'LANDSCAPE',
            segmentIndex: 0,
            yearlyEnergyDcKwh: 510,
          },
        ],
        solarPanelConfigs: [
          { panelsCount: 2, yearlyEnergyDcKwh: 1030 },
          { panelsCount: 67, yearlyEnergyDcKwh: 18151 },
        ],
      },
    };

    const normalized = normalizeSolarInsights(raw);

    expect(normalized.roof_area_m2).toBe(132);
    expect(normalized.sunshine_hours_per_year).toBe(1409);
    expect(normalized.carbon_offset_factor_kg_per_mwh).toBe(551);
    expect(normalized.max_panels).toBe(67);
    expect(normalized.max_annual_production_kwh).toBe(18151);
    expect(normalized.panel_placements).toHaveLength(2);
    expect(normalized.panel_placements[0]).toMatchObject({ index: 0, segmentIndex: 0, annualProductionKwh: 520 });
    expect(normalized.roof_segments[0]).toMatchObject({ index: 0, pitchDegrees: 16, azimuthDegrees: 182, areaMeters2: 64 });
    expect(normalized.data_layer_state).toMatchObject({ status: 'not_requested' });
    expect(normalized.raw_payload).toBe(raw);
  });
});
