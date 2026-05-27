import { makeId, nowIso } from '../../../shared/types/app';
import type { LeadRecord } from '../../leads/types';
import type { DealRecord } from '../../deals/types';
import type { SolarPanelPlacement, SolarRoofSegment, SolarSnapshot } from '../types';
import { selectedProductionFromPanels } from './solarVisualEditor';

function buildLocalPanelPlacements(maxPanels: number, maxAnnualProductionKwh: number): SolarPanelPlacement[] {
  const columns = maxPanels <= 12 ? 3 : maxPanels <= 24 ? 4 : 5;
  const width = 5.8;
  const height = 8;
  const gapX = 1.3;
  const gapY = 1.2;
  const rows = Math.ceil(maxPanels / columns);
  const startX = (100 - (columns * width + (columns - 1) * gapX)) / 2;
  const startY = Math.max(9, (70 - (rows * height + (rows - 1) * gapY)) / 2);
  const perPanelProduction = Math.round(maxAnnualProductionKwh / Math.max(1, maxPanels));
  return Array.from({ length: maxPanels }, (_, index) => ({
    index,
    segmentIndex: 0,
    orientation: 'LANDSCAPE',
    x: Number((startX + (index % columns) * (width + gapX)).toFixed(2)),
    y: Number((startY + Math.floor(index / columns) * (height + gapY)).toFixed(2)),
    width,
    height,
    heatScore: Math.max(48, Math.round(98 - (index / Math.max(1, maxPanels - 1)) * 38)),
    annualProductionKwh: perPanelProduction,
    geometrySource: 'local_estimate',
  }));
}

function buildLocalRoofSegments(lead: LeadRecord, roofAreaM2: number): SolarRoofSegment[] {
  return [{
    index: 0,
    center: lead.siteProfile.latitude && lead.siteProfile.longitude
      ? { latitude: lead.siteProfile.latitude, longitude: lead.siteProfile.longitude }
      : undefined,
    pitchDegrees: 12,
    azimuthDegrees: 180,
    areaMeters2: roofAreaM2,
    sunshineHoursPerYear: 1450,
  }];
}

export function createMapsPendingSnapshot(lead: LeadRecord, deal?: DealRecord): SolarSnapshot {
  const createdAt = nowIso();
  return {
    id: makeId('solar'),
    leadId: lead.id,
    dealId: deal?.id,
    latitude: lead.siteProfile.latitude,
    longitude: lead.siteProfile.longitude,
    status: 'maps_pending',
    imageryQuality: 'PENDING',
    roofCapacityKwp: 0,
    maxPanels: 0,
    panelCapacityWatts: 580,
    selectedPanelCount: 0,
    selectedSystemSizeKwp: 0,
    annualProductionKwh: 0,
    maxAnnualProductionKwh: 0,
    roofAreaM2: 0,
    sunshineHoursPerYear: 0,
    carbonOffsetFactorKgPerMwh: 0,
    roofSegments: [],
    panelPlacements: [],
    dataLayerState: {
      status: 'not_requested',
      reason: 'Solar Data Layers are not requested in Workbench v1.',
    },
    rawPayload: {},
    riskFlags: ['Google Solar API review is pending.'],
    nextAction: 'Run Solar Snapshot from confirmed pin.',
    createdAt,
    updatedAt: createdAt,
  };
}

export function runLocalSolarSnapshot(lead: LeadRecord, deal?: DealRecord): SolarSnapshot {
  const base = createMapsPendingSnapshot(lead, deal);
  if (!lead.siteProfile.location) return base;
  const billBasedSize = Math.max(3, Math.round(lead.energyProfile.monthlyBill / 8500));
  const maxPanels = Math.max(8, Math.ceil(billBasedSize / 0.58) + 4);
  const roofCapacityKwp = Number((maxPanels * 0.58).toFixed(2));
  const selectedPanelCount = Math.min(maxPanels, Math.max(1, Math.ceil(billBasedSize / 0.58)));
  const selectedSystemSizeKwp = Number((selectedPanelCount * 0.58).toFixed(2));
  const roofAreaM2 = Math.round(maxPanels * 1.95);
  const maxAnnualProductionKwh = Math.round(roofCapacityKwp * 1450);
  const panelPlacements = buildLocalPanelPlacements(maxPanels, maxAnnualProductionKwh);
  return {
    ...base,
    status: lead.siteProfile.latitude && lead.siteProfile.longitude ? 'ready' : 'low_quality',
    imageryQuality: lead.siteProfile.latitude && lead.siteProfile.longitude ? 'HIGH' : 'LOW',
    roofCapacityKwp,
    maxPanels,
    panelCapacityWatts: 580,
    selectedPanelCount,
    selectedSystemSizeKwp,
    annualProductionKwh: Math.round((maxAnnualProductionKwh / maxPanels) * selectedPanelCount),
    maxAnnualProductionKwh,
    roofAreaM2,
    sunshineHoursPerYear: 1450,
    carbonOffsetFactorKgPerMwh: 551,
    roofSegments: buildLocalRoofSegments(lead, roofAreaM2),
    panelPlacements,
    dataLayerState: {
      status: 'not_requested',
      reason: 'Solar Data Layers are deferred; Building Insights powers this Workbench.',
    },
    rawPayload: {
      source: 'local-development-solar-snapshot',
      solarPotential: {
        maxArrayPanelsCount: maxPanels,
        maxArrayAreaMeters2: roofAreaM2,
        maxSunshineHoursPerYear: 1450,
        panelCapacityWatts: 580,
      },
    },
    pitch: 12,
    azimuth: 180,
    riskFlags: lead.siteProfile.latitude && lead.siteProfile.longitude ? [] : ['Manual pin review required before dispatch.'],
    nextAction: lead.siteProfile.latitude && lead.siteProfile.longitude ? 'Solar Snapshot reviewed. Create or schedule deal survey.' : 'Request owner/manager manual dispatch override.',
    updatedAt: nowIso(),
  };
}

export function updatePanelLayout(snapshot: SolarSnapshot, input: { panelCount: number; panelCapacityWatts?: number }): SolarSnapshot {
  const panelCapacityWatts = input.panelCapacityWatts ?? snapshot.panelCapacityWatts;
  if (!Number.isFinite(panelCapacityWatts) || panelCapacityWatts <= 0) {
    throw new Error('Panel wattage must be greater than zero.');
  }
  const requestedPanelCount = Math.max(0, Math.round(input.panelCount));
  const selectedPanelCount = Math.min(snapshot.maxPanels, requestedPanelCount);
  const selectedSystemSizeKwp = Number(((selectedPanelCount * panelCapacityWatts) / 1000).toFixed(2));
  const maxAnnualProductionKwh = snapshot.maxAnnualProductionKwh ?? Math.round(snapshot.roofCapacityKwp * 1450);
  const panelPlacements = snapshot.panelPlacements?.length === snapshot.maxPanels && panelCapacityWatts === snapshot.panelCapacityWatts
    ? snapshot.panelPlacements
    : buildLocalPanelPlacements(snapshot.maxPanels, maxAnnualProductionKwh);
  const overRoofLimit = requestedPanelCount > snapshot.maxPanels;
  const roofLimitRisk = 'Selected panel count exceeds Solar Snapshot roof maximum.';
  const riskFlags = overRoofLimit
    ? snapshot.riskFlags.includes(roofLimitRisk)
      ? snapshot.riskFlags
      : [...snapshot.riskFlags, roofLimitRisk]
    : snapshot.riskFlags.filter((risk) => risk !== roofLimitRisk);
  return {
    ...snapshot,
    panelCapacityWatts,
    selectedPanelCount,
    selectedSystemSizeKwp,
    annualProductionKwh: selectedPanelCount === snapshot.maxPanels
      ? maxAnnualProductionKwh
      : selectedProductionFromPanels({ ...snapshot, panelPlacements, maxAnnualProductionKwh, panelCapacityWatts }, selectedPanelCount),
    maxAnnualProductionKwh,
    panelPlacements,
    riskFlags,
    updatedAt: nowIso(),
  };
}
