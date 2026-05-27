export type SolarWorkbenchLayer = 'insights' | 'mask' | 'flux' | 'dsm' | 'rgb' | 'arrays';
export type SolarWorkbenchMode = 'compact' | 'full' | 'readonly';

export interface SolarLatLng {
  latitude: number;
  longitude: number;
}

export interface SolarPanelPlacement {
  index: number;
  center?: SolarLatLng;
  orientation?: string;
  segmentIndex?: number;
  annualProductionKwh?: number;
  geometrySource?: 'google_building_insights' | 'local_estimate';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  heatScore?: number;
}

export interface SolarRoofSegment {
  index: number;
  center?: SolarLatLng;
  pitchDegrees?: number;
  azimuthDegrees?: number;
  areaMeters2?: number;
  sunshineHoursPerYear?: number;
}

export interface SolarDataLayerState {
  status: 'not_requested' | 'available' | 'unavailable';
  reason?: string;
  rgbUrl?: string;
  maskUrl?: string;
  dsmUrl?: string;
  annualFluxUrl?: string;
  monthlyFluxUrls?: string[];
}

export interface SolarApiMetricSummary {
  sunshineHoursPerYear: number;
  roofAreaM2: number;
  maxPanels: number;
  carbonOffsetFactorKgPerMwh: number;
  selectedPanelCount: number;
  selectedAnnualProductionKwh: number;
  selectedSystemSizeKwp: number;
}

export interface SolarSnapshot {
  id: string;
  leadId: string;
  dealId?: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
  status: 'maps_pending' | 'ready' | 'low_quality' | 'override_approved';
  imageryQuality: 'HIGH' | 'MEDIUM' | 'LOW' | 'PENDING';
  roofCapacityKwp: number;
  maxPanels: number;
  panelCapacityWatts: number;
  selectedPanelCount: number;
  selectedSystemSizeKwp: number;
  annualProductionKwh: number;
  maxAnnualProductionKwh?: number;
  roofAreaM2?: number;
  sunshineHoursPerYear?: number;
  carbonOffsetFactorKgPerMwh?: number;
  imageryDate?: string;
  imageryProcessedDate?: string;
  boundingBox?: {
    sw?: SolarLatLng;
    ne?: SolarLatLng;
  };
  roofSegments?: SolarRoofSegment[];
  panelPlacements?: SolarPanelPlacement[];
  dataLayerState?: SolarDataLayerState;
  rawPayload?: unknown;
  pitch?: number;
  azimuth?: number;
  riskFlags: string[];
  nextAction: string;
  createdAt: string;
  updatedAt: string;
}
