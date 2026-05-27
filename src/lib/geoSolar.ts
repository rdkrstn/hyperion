import type { Deal, GeoAddress, GeoPin, InstallerRoutePlan, InstallerRouteStop, SolarBuildingInsights } from '../types';

function stamp() {
  return new Date().toLocaleString('en-PH');
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

type RawSolarInsights = {
  name?: string;
  imageryQuality?: 'HIGH' | 'MEDIUM' | 'BASE';
  solarPotential?: {
    maxArrayPanelsCount?: number;
    panelCapacityWatts?: number;
    maxArrayAreaMeters2?: number;
    maxSunshineHoursPerYear?: number;
    roofSegmentStats?: Array<{ pitchDegrees?: number; azimuthDegrees?: number; stats?: { areaMeters2?: number } }>;
    solarPanelConfigs?: Array<{ panelsCount?: number; yearlyEnergyDcKwh?: number }>;
  };
};

export function buildStaticMapUrl(input: { latitude?: number; longitude?: number; apiKey?: string }) {
  if (!input.latitude || !input.longitude || !input.apiKey) return undefined;
  const coords = `${input.latitude.toFixed(6)},${input.longitude.toFixed(6)}`;
  return `https://maps.googleapis.com/maps/api/staticmap?size=640x360&scale=2&zoom=19&maptype=satellite&markers=color:green%7Clabel:S%7C${coords}&key=${input.apiKey}`;
}

export function buildMapsPendingSnapshot(deal: Deal, reason: string): { geoAddress: GeoAddress; geoPin: GeoPin; solarInsights: SolarBuildingInsights } {
  return {
    geoAddress: {
      formattedAddress: deal.readinessIntake?.location || deal.lead.location,
      source: 'manual',
      status: 'maps_pending',
    },
    geoPin: {
      latitude: deal.readinessIntake?.latitude,
      longitude: deal.readinessIntake?.longitude,
      accuracyMeters: deal.readinessIntake?.locationAccuracyMeters,
      confidence: 'maps_pending',
    },
    solarInsights: {
      id: id('solar'),
      status: 'maps_pending',
      roofSegments: [],
      riskFlags: [reason],
      createdAt: stamp(),
    },
  };
}

export function normalizeSolarBuildingInsights(raw: RawSolarInsights): SolarBuildingInsights {
  const potential = raw.solarPotential ?? {};
  const maxPanels = potential.maxArrayPanelsCount ?? 0;
  const panelCapacityWatts = potential.panelCapacityWatts ?? 0;
  const maxSystemSizeKwp = Number(((maxPanels * panelCapacityWatts) / 1000).toFixed(2));
  const bestConfig = [...(potential.solarPanelConfigs ?? [])].sort((a, b) => (b.yearlyEnergyDcKwh ?? 0) - (a.yearlyEnergyDcKwh ?? 0))[0];
  const verified = Boolean(raw.imageryQuality && raw.imageryQuality !== 'BASE' && maxSystemSizeKwp);
  const riskFlags = [
    !maxSystemSizeKwp ? 'Solar API returned no panel capacity.' : '',
    raw.imageryQuality === 'BASE' ? 'Solar API imagery quality is too low for formal quote.' : '',
  ].filter(Boolean);

  return {
    id: id('solar'),
    status: verified ? 'ready' : 'maps_pending',
    sourceName: raw.name,
    imageryQuality: raw.imageryQuality,
    maxUsableAreaMeters2: potential.maxArrayAreaMeters2,
    historicalIrradiance: potential.maxSunshineHoursPerYear,
    roofPitchDegrees: Math.round((potential.roofSegmentStats ?? [])[0]?.pitchDegrees ?? 0),
    roofAreaMeters2: potential.maxArrayAreaMeters2,
    maxPanels,
    panelCapacityWatts,
    maxSystemSizeKwp,
    maxSunshineHoursPerYear: potential.maxSunshineHoursPerYear,
    yearlyEnergyDcKwh: bestConfig?.yearlyEnergyDcKwh,
    roofSegments: (potential.roofSegmentStats ?? []).map((segment) => ({
      pitchDegrees: Math.round(segment.pitchDegrees ?? 0),
      azimuthDegrees: Math.round(segment.azimuthDegrees ?? 0),
      areaMeters2: Number((segment.stats?.areaMeters2 ?? 0).toFixed(1)),
    })),
    riskFlags,
    verifiedAt: verified ? stamp() : undefined,
    createdAt: stamp(),
  };
}

export function applySolarCapacityCap(recommendedKwp: number, insights?: SolarBuildingInsights) {
  if (!insights?.maxSystemSizeKwp || insights.maxSystemSizeKwp >= recommendedKwp) {
    return { sizeKwp: recommendedKwp, capped: false, reason: 'Bill-based sizing is within roof capacity.' };
  }
  return {
    sizeKwp: insights.maxSystemSizeKwp,
    capped: true,
    reason: `Solar API roof maximum caps the recommendation at ${insights.maxSystemSizeKwp} kWp.`,
  };
}

export function buildInstallerRoutePlan(input: {
  installerId: string;
  origin: { latitude?: number; longitude?: number };
  jobs: InstallerRouteStop[];
  matrix?: Array<{ dealId: string; durationMinutes: number; distanceKm: number }>;
}): InstallerRoutePlan {
  if (!input.origin.latitude || !input.origin.longitude || !input.matrix?.length) {
    return {
      id: id('route'),
      installerId: input.installerId,
      status: 'maps_pending',
      origin: input.origin,
      orderedStops: input.jobs,
      createdAt: stamp(),
    };
  }

  const matrix = new Map(input.matrix.map((entry) => [entry.dealId, entry]));
  const orderedStops = [...input.jobs]
    .map((job) => ({ ...job, ...matrix.get(job.dealId) }))
    .sort((a, b) => (a.durationMinutes ?? Number.MAX_SAFE_INTEGER) - (b.durationMinutes ?? Number.MAX_SAFE_INTEGER));

  return {
    id: id('route'),
    installerId: input.installerId,
    status: 'ready',
    origin: input.origin,
    orderedStops,
    createdAt: stamp(),
  };
}
