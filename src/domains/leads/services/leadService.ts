import { makeId, nowIso } from '../../../shared/types/app';
import { buildQualificationSections, missingQualificationItems, scoreQualification } from '../../qualification/rules/qualificationRules';
import type { LeadInput, LeadRecord, LeadSnapshot } from '../types';

export const FALLBACK_PHP_PER_KWH = 11;

export function hasConfirmedPin(input: Pick<LeadInput, 'latitude' | 'longitude'>) {
  return Number.isFinite(input.latitude) && Number.isFinite(input.longitude);
}

export function formatPinnedLocation(latitude?: number, longitude?: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  return `Pinned location (${latitude!.toFixed(6)}, ${longitude!.toFixed(6)})`;
}

export function normalizeLeadInput(input: LeadInput): LeadInput {
  const pinnedLocation = formatPinnedLocation(input.latitude, input.longitude);
  const location = input.location.trim() || input.standardizedAddress || pinnedLocation;
  const monthlyKwh = Number.isFinite(input.monthlyKwh) && (input.monthlyKwh ?? 0) > 0 ? Math.round(input.monthlyKwh!) : undefined;
  const monthlyBill = Number.isFinite(input.monthlyBill) && input.monthlyBill > 0
    ? Math.round(input.monthlyBill)
    : monthlyKwh
      ? Math.round(monthlyKwh * FALLBACK_PHP_PER_KWH)
      : 0;
  return {
    ...input,
    location,
    monthlyBill,
    monthlyKwh,
    standardizedAddress: input.standardizedAddress || (pinnedLocation ? location : input.standardizedAddress),
  };
}

export function createLeadRecord(input: LeadInput): LeadRecord {
  const normalized = normalizeLeadInput(input);
  const customerType = normalized.customerType ?? 'commercial';
  const readinessScore = scoreQualification({ ...normalized, customerType });
  const systemSize = normalized.monthlyKwh
    ? Math.max(3, Math.round(normalized.monthlyKwh / 120))
    : normalized.monthlyBill
      ? Math.max(3, Math.round(normalized.monthlyBill / 8500))
      : 0;
  const savingsLow = Math.round(normalized.monthlyBill * 0.28);
  const savingsHigh = Math.round(normalized.monthlyBill * 0.42);
  const createdAt = nowIso();
  const missingBlockers = missingQualificationItems(normalized);

  return {
    id: makeId('lead'),
    status: 'captured',
    businessName: normalized.businessName,
    contactName: normalized.contactName,
    phone: normalized.phone,
    email: normalized.email,
    source: normalized.source,
    customerType,
    assignedSales: normalized.assignedSales,
    goal: normalized.goal,
    readinessScore,
    solarFit: readinessScore >= 75 ? 'strong' : readinessScore >= 55 ? 'needs_review' : 'nurture',
    recommendedSystemRange: systemSize ? `${Math.max(1, systemSize - 2)}-${systemSize + 2} kWp` : 'Pending bill',
    estimatedSavingsRange: normalized.monthlyBill ? `PHP ${savingsLow.toLocaleString('en-PH')}-${savingsHigh.toLocaleString('en-PH')} / month` : 'Pending bill',
    paybackEstimate: normalized.monthlyBill >= 30000 ? '3.5-5.5 years' : 'Needs review',
    riskLevel: readinessScore >= 75 ? 'low' : readinessScore >= 55 ? 'medium' : 'high',
    qualificationSections: buildQualificationSections({ ...normalized, customerType }),
    billUploads: [],
    energyProfile: {
      monthlyBill: normalized.monthlyBill,
      monthlyKwh: normalized.monthlyKwh,
      daytimeUsage: normalized.daytimeUsage ?? 'unknown',
      operatingHours: normalized.operatingHours ?? 'Not captured',
      brownoutConcern: normalized.brownoutConcern ?? false,
      batteryInterest: normalized.batteryInterest ?? false,
    },
    siteProfile: {
      location: normalized.location,
      standardizedAddress: normalized.standardizedAddress,
      placeId: normalized.placeId,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      utilityProvider: normalized.utilityProvider,
      siteControl: normalized.siteControl,
    },
    missingBlockers,
    nextAction: 'Complete qualification.',
    createdAt,
    updatedAt: createdAt,
  };
}

export function recalculateLeadQualification(lead: LeadRecord): LeadRecord {
  const monthlyKwh = Number.isFinite(lead.energyProfile.monthlyKwh) && (lead.energyProfile.monthlyKwh ?? 0) > 0 ? Math.round(lead.energyProfile.monthlyKwh!) : undefined;
  const monthlyBill = lead.energyProfile.monthlyBill > 0
    ? Math.round(lead.energyProfile.monthlyBill)
    : monthlyKwh
      ? Math.round(monthlyKwh * FALLBACK_PHP_PER_KWH)
      : 0;
  const readinessScore = scoreQualification({
    contactName: lead.contactName,
    phone: lead.phone,
    location: lead.siteProfile.location,
    latitude: lead.siteProfile.latitude,
    longitude: lead.siteProfile.longitude,
    monthlyBill,
    monthlyKwh,
    goal: lead.goal,
    siteControl: lead.siteProfile.siteControl,
    customerType: lead.customerType,
    daytimeUsage: lead.energyProfile.daytimeUsage,
    batteryInterest: lead.energyProfile.batteryInterest,
    brownoutConcern: lead.energyProfile.brownoutConcern,
  });
  const systemSize = monthlyKwh
    ? Math.max(3, Math.round(monthlyKwh / 120))
    : monthlyBill
      ? Math.max(3, Math.round(monthlyBill / 8500))
      : 0;
  const savingsLow = Math.round(monthlyBill * 0.28);
  const savingsHigh = Math.round(monthlyBill * 0.42);
  const missingBlockers = missingQualificationItems({
    contactName: lead.contactName,
    phone: lead.phone,
    location: lead.siteProfile.location,
    latitude: lead.siteProfile.latitude,
    longitude: lead.siteProfile.longitude,
    monthlyBill,
    monthlyKwh,
    goal: lead.goal,
    siteControl: lead.siteProfile.siteControl,
    customerType: lead.customerType,
    daytimeUsage: lead.energyProfile.daytimeUsage,
    batteryInterest: lead.energyProfile.batteryInterest,
    brownoutConcern: lead.energyProfile.brownoutConcern,
  });

  return {
    ...lead,
    energyProfile: {
      ...lead.energyProfile,
      monthlyBill,
      monthlyKwh,
    },
    readinessScore,
    solarFit: readinessScore >= 75 ? 'strong' : readinessScore >= 55 ? 'needs_review' : 'nurture',
    recommendedSystemRange: systemSize ? `${Math.max(1, systemSize - 2)}-${systemSize + 2} kWp` : 'Pending bill',
    estimatedSavingsRange: monthlyBill ? `PHP ${savingsLow.toLocaleString('en-PH')}-${savingsHigh.toLocaleString('en-PH')} / month` : 'Pending bill',
    paybackEstimate: monthlyBill >= 30000 ? '3.5-5.5 years' : 'Needs review',
    riskLevel: readinessScore >= 75 ? 'low' : readinessScore >= 55 ? 'medium' : 'high',
    qualificationSections: buildQualificationSections({
      contactName: lead.contactName,
      phone: lead.phone,
      location: lead.siteProfile.location,
      latitude: lead.siteProfile.latitude,
      longitude: lead.siteProfile.longitude,
      monthlyBill,
      monthlyKwh,
      goal: lead.goal,
      siteControl: lead.siteProfile.siteControl,
      customerType: lead.customerType,
      daytimeUsage: lead.energyProfile.daytimeUsage,
      batteryInterest: lead.energyProfile.batteryInterest,
      brownoutConcern: lead.energyProfile.brownoutConcern,
    }),
    missingBlockers,
    nextAction: lead.status === 'qualified' || missingBlockers.length === 0 ? 'Create deal.' : 'Complete qualification.',
    updatedAt: nowIso(),
  };
}

export function canCreateDealFromLead(lead: LeadRecord) {
  if (lead.qualificationOverride?.reason) return { allowed: true, missing: [] };
  const missing = [
    lead.contactName && lead.phone ? '' : 'contact',
    lead.siteProfile.location ? '' : 'location',
    lead.energyProfile.monthlyBill || lead.energyProfile.monthlyKwh ? '' : 'bill or estimated bill',
    lead.goal ? '' : 'goal',
    lead.siteProfile.siteControl && lead.siteProfile.siteControl !== 'unknown' ? '' : 'site-control answer',
  ].filter(Boolean);
  return { allowed: missing.length === 0, missing };
}

export function qualifyLead(lead: LeadRecord, options: { overrideReason?: string; actorId?: string } = {}): LeadRecord {
  const gate = canCreateDealFromLead(lead);
  const status = gate.allowed || options.overrideReason ? 'qualified' : lead.status;
  return {
    ...lead,
    status,
    qualificationOverride: options.overrideReason
      ? { reason: options.overrideReason, actorId: options.actorId, createdAt: nowIso() }
      : lead.qualificationOverride,
    missingBlockers: options.overrideReason ? [] : gate.missing,
    nextAction: status === 'qualified' ? 'Create deal.' : 'Complete qualification.',
    updatedAt: nowIso(),
  };
}

export function leadSnapshot(lead: LeadRecord): LeadSnapshot {
  return {
    leadId: lead.id,
    businessName: lead.businessName,
    contactName: lead.contactName,
    location: lead.siteProfile.location,
    monthlyBill: lead.energyProfile.monthlyBill,
    goal: lead.goal,
    siteControl: lead.siteProfile.siteControl,
    readinessScore: lead.readinessScore,
  };
}
