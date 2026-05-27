import { describe, expect, it } from 'vitest';
import type { SolarSnapshot } from '../types';
import { buildRoofOverlayBounds, buildRoofVisualPanelSlots, getPanelGeometrySource, nextPanelCountFromVisualClick } from './solarVisualEditor';

const snapshot: SolarSnapshot = {
  id: 'solar-1',
  leadId: 'lead-1',
  dealId: 'deal-1',
  status: 'ready',
  imageryQuality: 'HIGH',
  roofCapacityKwp: 9.86,
  maxPanels: 17,
  panelCapacityWatts: 580,
  selectedPanelCount: 13,
  selectedSystemSizeKwp: 7.54,
  annualProductionKwh: 10933,
  maxAnnualProductionKwh: 14288,
  roofAreaM2: 82,
  sunshineHoursPerYear: 1450,
  carbonOffsetFactorKgPerMwh: 551,
  dataLayerState: { status: 'not_requested' },
  riskFlags: [],
  nextAction: 'Build proposal.',
  createdAt: '2026-05-22T00:00:00.000Z',
  updatedAt: '2026-05-22T00:00:00.000Z',
};

describe('solar visual editor helpers', () => {
  it('builds deterministic roof panel slots from Solar Snapshot capacity', () => {
    const slots = buildRoofVisualPanelSlots(snapshot);

    expect(slots).toHaveLength(17);
    expect(slots.filter((slot) => slot.selected)).toHaveLength(13);
    expect(slots[0].heatScore).toBeGreaterThan(slots.at(-1)!.heatScore);
  });

  it('adds or removes one panel from visual slot clicks', () => {
    expect(nextPanelCountFromVisualClick(snapshot, 13)).toBe(14);
    expect(nextPanelCountFromVisualClick(snapshot, 3)).toBe(12);
    expect(nextPanelCountFromVisualClick(snapshot, 99)).toBe(13);
  });

  it('uses Google panel placements when the Solar API returns geometry', () => {
    const geometrySnapshot: SolarSnapshot = {
      ...snapshot,
      maxPanels: 2,
      selectedPanelCount: 1,
      panelPlacements: [
        { index: 0, x: 11, y: 12, width: 6, height: 10, heatScore: 97, annualProductionKwh: 580 },
        { index: 1, x: 21, y: 12, width: 6, height: 10, heatScore: 91, annualProductionKwh: 540 },
      ],
    };

    const slots = buildRoofVisualPanelSlots(geometrySnapshot);

    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({ x: 11, y: 12, width: 6, height: 10, selected: true });
    expect(slots[1]).toMatchObject({ heatScore: 91, selected: false });
  });

  it('distinguishes real Google panel geometry from local estimate slots', () => {
    expect(getPanelGeometrySource(snapshot)).toBe('missing');

    const localEstimate: SolarSnapshot = {
      ...snapshot,
      panelPlacements: [
        { index: 0, x: 11, y: 12, width: 6, height: 10, heatScore: 97, annualProductionKwh: 580 },
      ],
    };
    expect(getPanelGeometrySource(localEstimate)).toBe('local_estimate');

    const googleGeometry: SolarSnapshot = {
      ...snapshot,
      panelPlacements: [
        {
          index: 0,
          center: { latitude: 10.8167, longitude: 122.5424 },
          orientation: 'LANDSCAPE',
          segmentIndex: 0,
          annualProductionKwh: 580,
        },
      ],
    };
    expect(getPanelGeometrySource(googleGeometry)).toBe('google_building_insights');
  });

  it('builds a compact geographic overlay around the pinned roof instead of page-fixed coordinates', () => {
    const bounds = buildRoofOverlayBounds({
      ...snapshot,
      latitude: 10.816663,
      longitude: 122.542422,
      roofAreaM2: 132,
    });

    expect(bounds).toMatchObject({
      center: { latitude: 10.816663, longitude: 122.542422 },
    });
    expect(bounds.widthMeters).toBeLessThanOrEqual(32);
    expect(bounds.heightMeters).toBeLessThanOrEqual(24);
    expect(bounds.north).toBeGreaterThan(10.816663);
    expect(bounds.south).toBeLessThan(10.816663);
    expect(bounds.east).toBeGreaterThan(122.542422);
    expect(bounds.west).toBeLessThan(122.542422);
  });
});
