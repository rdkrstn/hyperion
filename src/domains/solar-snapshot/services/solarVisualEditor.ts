import type { SolarApiMetricSummary, SolarPanelPlacement, SolarSnapshot } from '../types';

export interface RoofVisualPanelSlot {
  index: number;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  heatScore: number;
  annualProductionKwh?: number;
  selected: boolean;
}

export type PanelGeometrySource = 'google_building_insights' | 'local_estimate' | 'missing';

function hasFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function getPanelGeometrySource(snapshot: SolarSnapshot): PanelGeometrySource {
  const placements = snapshot.panelPlacements ?? [];
  if (placements.some((placement) => hasFiniteCoordinate(placement.center?.latitude) && hasFiniteCoordinate(placement.center?.longitude))) {
    return 'google_building_insights';
  }
  if (placements.some((placement) => hasFiniteCoordinate(placement.x) && hasFiniteCoordinate(placement.y))) {
    return 'local_estimate';
  }
  return 'missing';
}

function placementToSlot(placement: SolarPanelPlacement, index: number, selectedPanelCount: number): RoofVisualPanelSlot {
  return {
    index,
    row: Math.floor(index / 6),
    col: index % 6,
    x: placement.x ?? 12 + (index % 6) * 7.2,
    y: placement.y ?? 12 + Math.floor(index / 6) * 8.4,
    width: placement.width ?? 5.8,
    height: placement.height ?? 8,
    heatScore: placement.heatScore ?? Math.max(45, 98 - index * 2),
    annualProductionKwh: placement.annualProductionKwh,
    selected: index < selectedPanelCount,
  };
}

export function buildRoofVisualPanelSlots(snapshot: SolarSnapshot): RoofVisualPanelSlot[] {
  const maxPanels = Math.max(0, snapshot.maxPanels);
  if (!maxPanels) return [];
  if (snapshot.panelPlacements?.length) {
    return snapshot.panelPlacements
      .slice(0, maxPanels)
      .map((placement, index) => placementToSlot(placement, index, snapshot.selectedPanelCount));
  }
  const columns = maxPanels <= 12 ? 3 : maxPanels <= 24 ? 4 : 5;
  const rows = Math.ceil(maxPanels / columns);
  const width = 12;
  const height = 7;
  const gap = 2;
  const totalWidth = columns * width + (columns - 1) * gap;
  const totalHeight = rows * height + (rows - 1) * gap;
  const startX = (100 - totalWidth) / 2;
  const startY = (70 - totalHeight) / 2;

  return Array.from({ length: maxPanels }, (_, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const heatScore = Math.max(45, Math.round(98 - (index / Math.max(1, maxPanels - 1)) * 42));
    return {
      index,
      row,
      col,
      x: startX + col * (width + gap),
      y: startY + row * (height + gap),
      width,
      height,
      heatScore,
      annualProductionKwh: Math.round((snapshot.maxAnnualProductionKwh ?? snapshot.roofCapacityKwp * 1450) / Math.max(1, maxPanels)),
      selected: index < snapshot.selectedPanelCount,
    };
  });
}

export function nextPanelCountFromVisualClick(snapshot: SolarSnapshot, slotIndex: number) {
  if (slotIndex < 0 || slotIndex >= snapshot.maxPanels) return snapshot.selectedPanelCount;
  if (slotIndex < snapshot.selectedPanelCount) return Math.max(0, snapshot.selectedPanelCount - 1);
  return Math.min(snapshot.maxPanels, snapshot.selectedPanelCount + 1);
}

export function heatColor(score: number) {
  if (score >= 86) return '#ef4444';
  if (score >= 74) return '#f97316';
  if (score >= 62) return '#facc15';
  return '#84cc16';
}

export function buildRoofOverlayBounds(snapshot: SolarSnapshot) {
  const latitude = snapshot.latitude ?? 0;
  const longitude = snapshot.longitude ?? 0;
  const googlePlacements = snapshot.panelPlacements?.filter((placement) => (
    hasFiniteCoordinate(placement.center?.latitude) && hasFiniteCoordinate(placement.center?.longitude)
  )) ?? [];

  if (googlePlacements.length) {
    const latitudes = googlePlacements.map((placement) => placement.center!.latitude);
    const longitudes = googlePlacements.map((placement) => placement.center!.longitude);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const latPadding = Math.max(0.000018, (maxLatitude - minLatitude) * 0.55);
    const lngPadding = Math.max(0.000018, (maxLongitude - minLongitude) * 0.55);

    return {
      center: { latitude, longitude },
      widthMeters: 0,
      heightMeters: 0,
      north: maxLatitude + latPadding,
      south: minLatitude - latPadding,
      east: maxLongitude + lngPadding,
      west: minLongitude - lngPadding,
    };
  }

  const inferredArea = snapshot.roofAreaM2 && snapshot.roofAreaM2 > 0
    ? snapshot.roofAreaM2
    : Math.max(24, snapshot.maxPanels * 1.95);
  const widthMeters = Math.max(14, Math.min(32, Math.sqrt(inferredArea) * 1.75));
  const heightMeters = Math.max(10, Math.min(24, widthMeters * 0.72));
  const latMeters = 111_320;
  const lngMeters = Math.max(1, 111_320 * Math.cos((latitude * Math.PI) / 180));
  const latDelta = (heightMeters / 2) / latMeters;
  const lngDelta = (widthMeters / 2) / lngMeters;

  return {
    center: { latitude, longitude },
    widthMeters,
    heightMeters,
    north: latitude + latDelta,
    south: latitude - latDelta,
    east: longitude + lngDelta,
    west: longitude - lngDelta,
  };
}

export function selectedProductionFromPanels(snapshot: SolarSnapshot, panelCount: number) {
  const selected = Math.max(0, Math.min(snapshot.maxPanels, Math.round(panelCount)));
  if (snapshot.panelPlacements?.length) {
    const production = snapshot.panelPlacements
      .slice(0, selected)
      .reduce((sum, panel) => sum + (panel.annualProductionKwh ?? 0), 0);
    if (production > 0) return Math.round(production);
  }
  const maxProduction = snapshot.maxAnnualProductionKwh ?? Math.round(snapshot.roofCapacityKwp * 1450);
  return Math.round((maxProduction / Math.max(1, snapshot.maxPanels)) * selected);
}

export function buildSolarApiMetricSummary(snapshot: SolarSnapshot): SolarApiMetricSummary {
  return {
    sunshineHoursPerYear: Math.round(snapshot.sunshineHoursPerYear ?? 0),
    roofAreaM2: Math.round(snapshot.roofAreaM2 ?? 0),
    maxPanels: snapshot.maxPanels,
    carbonOffsetFactorKgPerMwh: Math.round(snapshot.carbonOffsetFactorKgPerMwh ?? 0),
    selectedPanelCount: snapshot.selectedPanelCount,
    selectedAnnualProductionKwh: snapshot.annualProductionKwh,
    selectedSystemSizeKwp: snapshot.selectedSystemSizeKwp,
  };
}

export function sanitizeSolarApiResponse(snapshot: SolarSnapshot) {
  const payload = snapshot.rawPayload && typeof snapshot.rawPayload === 'object'
    ? snapshot.rawPayload as Record<string, unknown>
    : {};
  return {
    name: payload.name,
    imageryQuality: payload.imageryQuality ?? snapshot.imageryQuality,
    imageryDate: payload.imageryDate ?? snapshot.imageryDate,
    solarPotential: payload.solarPotential ? {
      maxArrayPanelsCount: (payload.solarPotential as Record<string, unknown>).maxArrayPanelsCount,
      maxArrayAreaMeters2: (payload.solarPotential as Record<string, unknown>).maxArrayAreaMeters2,
      maxSunshineHoursPerYear: (payload.solarPotential as Record<string, unknown>).maxSunshineHoursPerYear,
      panelCapacityWatts: (payload.solarPotential as Record<string, unknown>).panelCapacityWatts,
      roofSegmentStats: snapshot.roofSegments,
      selectedPanelCount: snapshot.selectedPanelCount,
      selectedSystemSizeKwp: snapshot.selectedSystemSizeKwp,
    } : {
      maxArrayPanelsCount: snapshot.maxPanels,
      maxArrayAreaMeters2: snapshot.roofAreaM2,
      maxSunshineHoursPerYear: snapshot.sunshineHoursPerYear,
      panelCapacityWatts: snapshot.panelCapacityWatts,
      roofSegmentStats: snapshot.roofSegments,
      selectedPanelCount: snapshot.selectedPanelCount,
      selectedSystemSizeKwp: snapshot.selectedSystemSizeKwp,
    },
    dataLayerState: snapshot.dataLayerState ?? { status: 'not_requested' },
  };
}
