import { ApiError } from './errors.ts';

export function extractBillFields(text: string, confidence = 0) {
  const kwhMatch = text.match(/(?:12[-\s]?month|average|avg)[^\d]{0,30}([\d,]+(?:\.\d+)?)\s*kwh/i)
    ?? text.match(/([\d,]+(?:\.\d+)?)\s*kwh/i);
  const amountMatch = text.match(/(?:amount due|total amount|bill amount|current charges)[^\d]{0,20}(?:php|p|₱)?\s*([\d,]+(?:\.\d+)?)/i);
  const periodMatch = text.match(/(?:billing period|bill period)[:\s]+([A-Za-z0-9,\s-]{6,40})/i);
  const providerMatch = text.match(/\b(Meralco|MORE Power|VECO|BENECO|Davao Light|Cepalco)\b/i);
  const kwh = kwhMatch ? Number(kwhMatch[1].replaceAll(',', '')) : undefined;
  return {
    bill_amount: amountMatch ? Number(amountMatch[1].replaceAll(',', '')) : undefined,
    kwh,
    billing_period: periodMatch?.[1]?.trim(),
    provider: providerMatch?.[1],
    confidence,
    needs_manual_review: !kwh || confidence < 0.65,
  };
}

export async function callGoogleVision(apiKey: string, base64Content: string) {
  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ image: { content: base64Content }, features: [{ type: 'TEXT_DETECTION' }] }] }),
  });
  if (!response.ok) throw new ApiError('upstream_unavailable', `Google Vision OCR failed with ${response.status}.`, 502);
  const body = await response.json();
  const annotation = body.responses?.[0]?.fullTextAnnotation;
  return { text: annotation?.text ?? '', confidence: annotation?.pages?.[0]?.confidence ?? 0 };
}

export function normalizeSolarInsights(raw: any) {
  const configs = Array.isArray(raw?.solarPotential?.solarPanelConfigs) ? raw.solarPotential.solarPanelConfigs : [];
  const config = configs[0];
  const maxConfig = configs.at(-1) ?? config;
  const panelCapacityWatts = Number(raw?.solarPotential?.panelCapacityWatts ?? 400);
  const maxPanels = Number(raw?.solarPotential?.maxArrayPanelsCount ?? maxConfig?.panelsCount ?? config?.panelsCount ?? 0);
  const roofCapacityKwp = Number(((maxPanels * panelCapacityWatts) / 1000).toFixed(2));
  const selectedPanelCount = Number(config?.panelsCount ?? maxPanels);
  const selectedSystemSizeKwp = Number(((selectedPanelCount * panelCapacityWatts) / 1000).toFixed(2));
  const annualProductionKwh = Number(config?.yearlyEnergyDcKwh ?? 0);
  const maxAnnualProductionKwh = Number(maxConfig?.yearlyEnergyDcKwh ?? annualProductionKwh);
  const imageryQuality = String(raw?.imageryQuality ?? 'UNKNOWN');
  const roofSegments = (raw?.solarPotential?.roofSegmentStats ?? []).map((segment: any, index: number) => ({
    index,
    center: segment?.center,
    pitchDegrees: segment?.pitchDegrees,
    azimuthDegrees: segment?.azimuthDegrees,
    areaMeters2: segment?.stats?.areaMeters2,
    sunshineHoursPerYear: Array.isArray(segment?.stats?.sunshineQuantiles)
      ? segment.stats.sunshineQuantiles.at(-1)
      : undefined,
  }));
  const panelPlacements = (raw?.solarPotential?.solarPanels ?? []).map((panel: any, index: number) => ({
    index,
    center: panel?.center,
    orientation: panel?.orientation,
    segmentIndex: panel?.segmentIndex,
    annualProductionKwh: panel?.yearlyEnergyDcKwh,
    geometrySource: panel?.center ? 'google_building_insights' : undefined,
  }));
  return {
    roof_capacity_kwp: roofCapacityKwp,
    max_panels: maxPanels,
    panel_capacity_watts: panelCapacityWatts,
    selected_panel_count: selectedPanelCount,
    selected_system_size_kwp: selectedSystemSizeKwp,
    annual_production_kwh: annualProductionKwh,
    max_annual_production_kwh: maxAnnualProductionKwh,
    imagery_quality: imageryQuality,
    roof_area_m2: Number(raw?.solarPotential?.maxArrayAreaMeters2 ?? raw?.solarPotential?.wholeRoofStats?.areaMeters2 ?? 0),
    sunshine_hours_per_year: Number(raw?.solarPotential?.maxSunshineHoursPerYear ?? 0),
    carbon_offset_factor_kg_per_mwh: Number(raw?.solarPotential?.carbonOffsetFactorKgPerMwh ?? 0),
    imagery_date: raw?.imageryDate,
    imagery_processed_date: raw?.imageryProcessedDate,
    bounding_box: raw?.boundingBox,
    building_center: raw?.center,
    roof_segments: roofSegments,
    panel_placements: panelPlacements,
    data_layer_state: {
      status: 'not_requested',
      reason: 'Solar Data Layers are deferred; Building Insights powers Workbench v1.',
    },
    pitch: raw?.solarPotential?.roofSegmentStats?.[0]?.pitchDegrees,
    azimuth: raw?.solarPotential?.roofSegmentStats?.[0]?.azimuthDegrees,
    risk_flags: imageryQuality === 'HIGH' || imageryQuality === 'MEDIUM' ? [] : ['Solar imagery quality requires review.'],
    dispatch_gate: roofCapacityKwp > 0 && (imageryQuality === 'HIGH' || imageryQuality === 'MEDIUM') ? 'ready' : 'manual_override_required',
    recommended_next_action: roofCapacityKwp > 0 ? 'Use Solar Snapshot for survey dispatch.' : 'Request owner/manager manual dispatch override.',
    raw_payload: raw,
  };
}
