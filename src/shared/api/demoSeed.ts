import type { DealRecord } from '../../domains/deals/types';
import type { DocumentRecord } from '../../domains/documents/types';
import { annualizeBillHistory, summarizeBillHistory } from '../../domains/leads/services/billHistoryService';
import { createLeadRecord, leadSnapshot } from '../../domains/leads/services/leadService';
import type { BillHistoryMonth, BillUpload, LeadInput, LeadRecord } from '../../domains/leads/types';
import type { SolarPanelPlacement, SolarSnapshot } from '../../domains/solar-snapshot/types';
import type { TimelineEvent } from '../types/app';

const createdAt = '2026-05-22T08:00:00.000Z';
const updatedAt = '2026-05-22T08:00:00.000Z';

export interface DemoSeedCollections {
  leads: LeadRecord[];
  deals: DealRecord[];
  solarSnapshots: SolarSnapshot[];
  documents: DocumentRecord[];
  timelineEvents: TimelineEvent[];
}

function svgDataUrl(title: string, subtitle: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="#f8fafc"/><rect x="48" y="48" width="864" height="444" rx="18" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/><text x="84" y="132" font-family="Arial" font-size="42" font-weight="700" fill="#0f172a">${title}</text><text x="84" y="190" font-family="Arial" font-size="28" fill="#334155">${subtitle}</text><line x1="84" y1="238" x2="876" y2="238" stroke="#e2e8f0" stroke-width="3"/><text x="84" y="310" font-family="Arial" font-size="24" fill="#475569">Local demo file for recording. Replace with Supabase Storage upload in production.</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function observedBillMonths(amounts: number[], kwhValues: number[]): BillHistoryMonth[] {
  const labels = ['February 2026', 'March 2026', 'April 2026'];
  return amounts.map((billAmount, index) => ({
    periodLabel: labels[index] ?? `Observed ${index + 1}`,
    billAmount,
    kwh: kwhValues[index],
    source: 'observed',
  }));
}

function billUpload(input: {
  id: string;
  leadId: string;
  documentId: string;
  provider: string;
  billAmount: number;
  kwh: number;
  confidence: number;
  months: BillHistoryMonth[];
}): { upload: BillUpload; months: BillHistoryMonth[]; averageBill: number; averageKwh?: number } {
  const annualized = annualizeBillHistory(input.months);
  const summary = summarizeBillHistory(annualized.months);
  return {
    upload: {
      id: input.id,
      leadId: input.leadId,
      documentId: input.documentId,
      status: 'ocr_completed',
      extractedMonthlyKwh: input.kwh,
      extractedBillAmount: input.billAmount,
      billingPeriod: 'April 2026',
      provider: input.provider,
      confidence: input.confidence,
      ocrProvider: 'gemini',
      monthlySeries: annualized.months,
      annualized: annualized.annualized,
      sourceMonthCount: annualized.sourceMonthCount,
    },
    months: annualized.months,
    averageBill: summary.averageMonthlyBill,
    averageKwh: summary.averageMonthlyKwh,
  };
}

function leadFromInput(input: LeadInput, overrides: Partial<LeadRecord>): LeadRecord {
  const lead = createLeadRecord(input);
  return {
    ...lead,
    createdAt,
    updatedAt,
    ...overrides,
    energyProfile: {
      ...lead.energyProfile,
      ...overrides.energyProfile,
    },
    siteProfile: {
      ...lead.siteProfile,
      ...overrides.siteProfile,
    },
    qualificationSections: overrides.qualificationSections ?? lead.qualificationSections,
    billUploads: overrides.billUploads ?? lead.billUploads,
  };
}

function document(input: {
  id: string;
  leadId: string;
  dealId?: string;
  category: DocumentRecord['category'];
  fileName: string;
  label: string;
  status: DocumentRecord['validationStatus'];
}): DocumentRecord {
  return {
    id: input.id,
    leadId: input.leadId,
    dealId: input.dealId,
    category: input.category,
    fileName: input.fileName,
    mimeType: 'image/svg+xml',
    bucket: 'deal-files',
    storagePath: `${input.leadId}/${input.category}/${input.fileName}`,
    validationStatus: input.status,
    uploadedBy: 'sales-1',
    validatedBy: input.status === 'validated' ? 'cs-1' : undefined,
    fileDataUrl: svgDataUrl(input.label, input.fileName),
    createdAt,
    updatedAt,
  };
}

function localPanels(maxPanels: number): SolarPanelPlacement[] {
  const columns = maxPanels > 60 ? 9 : maxPanels > 30 ? 6 : 4;
  return Array.from({ length: maxPanels }, (_, index) => ({
    index,
    x: Number((12 + (index % columns) * 7).toFixed(2)),
    y: Number((12 + Math.floor(index / columns) * 8).toFixed(2)),
    width: 5.2,
    height: 7.2,
    heatScore: Math.max(45, 96 - index),
    geometrySource: 'local_estimate',
    orientation: 'LANDSCAPE',
    segmentIndex: 0,
  }));
}

function solar(input: {
  id: string;
  lead: LeadRecord;
  dealId?: string;
  status: SolarSnapshot['status'];
  imageryQuality: SolarSnapshot['imageryQuality'];
  roofCapacityKwp: number;
  maxPanels: number;
  selectedPanelCount: number;
  selectedSystemSizeKwp: number;
  annualProductionKwh: number;
  nextAction: string;
  riskFlags?: string[];
}): SolarSnapshot {
  return {
    id: input.id,
    leadId: input.lead.id,
    dealId: input.dealId,
    latitude: input.lead.siteProfile.latitude,
    longitude: input.lead.siteProfile.longitude,
    status: input.status,
    imageryQuality: input.imageryQuality,
    roofCapacityKwp: input.roofCapacityKwp,
    maxPanels: input.maxPanels,
    panelCapacityWatts: Math.round((input.roofCapacityKwp * 1000) / input.maxPanels),
    selectedPanelCount: input.selectedPanelCount,
    selectedSystemSizeKwp: input.selectedSystemSizeKwp,
    annualProductionKwh: input.annualProductionKwh,
    maxAnnualProductionKwh: Math.round(input.roofCapacityKwp * 1450),
    roofAreaM2: Math.round(input.maxPanels * 1.95),
    sunshineHoursPerYear: input.imageryQuality === 'HIGH' ? 1480 : 1320,
    carbonOffsetFactorKgPerMwh: 551,
    pitch: input.imageryQuality === 'HIGH' ? 12 : 18,
    azimuth: 180,
    roofSegments: [{
      index: 0,
      center: input.lead.siteProfile.latitude && input.lead.siteProfile.longitude
        ? { latitude: input.lead.siteProfile.latitude, longitude: input.lead.siteProfile.longitude }
        : undefined,
      pitchDegrees: input.imageryQuality === 'HIGH' ? 12 : 18,
      azimuthDegrees: 180,
      areaMeters2: Math.round(input.maxPanels * 1.95),
      sunshineHoursPerYear: input.imageryQuality === 'HIGH' ? 1480 : 1320,
    }],
    panelPlacements: localPanels(input.maxPanels),
    dataLayerState: {
      status: 'not_requested',
      reason: 'Demo seed uses Building Insights-style metrics without live Data Layers.',
    },
    rawPayload: {
      source: 'local-demo-seed',
      imageryQuality: input.imageryQuality,
      maxPanels: input.maxPanels,
    },
    riskFlags: input.riskFlags ?? [],
    nextAction: input.nextAction,
    createdAt,
    updatedAt,
  };
}

function deal(input: {
  id: string;
  lead: LeadRecord;
  name: string;
  value: number;
  nextAction: string;
  blocker?: string;
  documentStatus: DealRecord['documentStatus'];
  solarSnapshotStatus: DealRecord['solarSnapshotStatus'];
  systemSizeKwp: number;
  paymentOption: string;
}): DealRecord {
  return {
    id: input.id,
    leadId: input.lead.id,
    name: input.name,
    value: input.value,
    stage: 'solar_snapshot_reviewed',
    status: 'open',
    source: input.lead.source,
    salesOwner: input.lead.assignedSales,
    expectedCloseDate: '2026-06-15',
    surveyStatus: 'not_scheduled',
    proposalStatus: 'draft',
    portalStatus: 'not_shared',
    solarSnapshotStatus: input.solarSnapshotStatus,
    documentStatus: input.documentStatus,
    contractStatus: 'not_started',
    paymentStatus: 'not_started',
    nextAction: input.nextAction,
    blocker: input.blocker,
    leadSnapshot: leadSnapshot(input.lead),
    commercialPacket: {
      proposedSystemSizeKwp: input.systemSizeKwp,
      estimatedPrice: input.value,
      grossMarginPercent: 32,
      paymentOption: input.paymentOption,
    },
    financingReadiness: {
      status: input.documentStatus === 'validated' ? 'ready_for_lender' : 'missing_requirements',
      riskFlags: input.blocker ? [input.blocker] : [],
      affordabilityProfile: input.paymentOption,
    },
    createdAt,
    updatedAt,
  };
}

function timeline(id: string, ownerType: TimelineEvent['ownerType'], ownerId: string, title: string, description: string): TimelineEvent {
  return {
    id,
    ownerType,
    ownerId,
    title,
    description,
    actorRole: 'system',
    createdAt,
  };
}

export function isDemoSeedId(id: string | undefined) {
  return Boolean(id?.includes('-demo-'));
}

export function buildDemoSeed(): DemoSeedCollections {
  const goldenBill = billUpload({
    id: 'bill-demo-golden-msme',
    leadId: 'lead-demo-golden-msme',
    documentId: 'doc-demo-golden-bill',
    provider: 'MORE Power',
    billAmount: 45000,
    kwh: 4150,
    confidence: 0.92,
    months: observedBillMonths([43800, 46200, 45000], [3980, 4300, 4150]),
  });
  const golden = leadFromInput({
    businessName: 'Iloilo Mini Mart',
    contactName: 'Ramon Dela Cruz',
    phone: '09171230001',
    source: 'd2d',
    customerType: 'commercial',
    location: 'Santa Barbara, Iloilo',
    standardizedAddress: 'Santa Barbara, Iloilo, Philippines',
    latitude: 10.8231,
    longitude: 122.5346,
    utilityProvider: 'MORE Power',
    monthlyBill: 45000,
    monthlyKwh: 4150,
    goal: 'both',
    siteControl: 'owned',
    assignedSales: 'sales-1',
    daytimeUsage: 'high',
    batteryInterest: true,
    brownoutConcern: true,
  }, {
    id: 'lead-demo-golden-msme',
    status: 'qualified',
    readinessScore: 86,
    solarFit: 'strong',
    recommendedSystemRange: '10-15 kWp',
    estimatedSavingsRange: 'PHP 18,000-28,000 / month',
    paybackEstimate: '3.5-5.0 years',
    riskLevel: 'low',
    billUploads: [goldenBill.upload],
    energyProfile: {
      monthlyBill: 45000,
      monthlyKwh: 4150,
      billHistory: goldenBill.months,
      annualizedMonthlyBill: goldenBill.averageBill,
      annualizedMonthlyKwh: goldenBill.averageKwh,
      billHistoryMonths: 3,
      billHistoryAnnualized: true,
      daytimeUsage: 'high',
      operatingHours: '7 AM-9 PM daily',
      brownoutConcern: true,
      batteryInterest: true,
      currentBackupSetup: 'Small UPS for POS only',
    },
    missingBlockers: ['valid ID pending', 'site/property proof pending'],
    nextAction: 'Schedule installer survey.',
  });

  const residentialBill = billUpload({
    id: 'bill-demo-residential-blocked',
    leadId: 'lead-demo-residential-blocked',
    documentId: 'doc-demo-residential-bill',
    provider: 'MORE Power',
    billAmount: 4800,
    kwh: 430,
    confidence: 0.88,
    months: observedBillMonths([4500, 5100, 4800], [390, 455, 430]),
  });
  const residential = leadFromInput({
    businessName: 'Maria Santos',
    contactName: 'Maria Santos',
    phone: '09171230002',
    source: 'public_inquiry',
    customerType: 'residential',
    location: 'Pavia, Iloilo',
    standardizedAddress: 'Pavia, Iloilo, Philippines',
    latitude: 10.7769,
    longitude: 122.5449,
    utilityProvider: 'MORE Power',
    monthlyBill: 4800,
    monthlyKwh: 430,
    goal: 'lower_bill',
    siteControl: 'rented_needs_authorization',
    assignedSales: 'sales-1',
    daytimeUsage: 'medium',
  }, {
    id: 'lead-demo-residential-blocked',
    status: 'captured',
    readinessScore: 54,
    solarFit: 'nurture',
    recommendedSystemRange: '2-3 kWp',
    estimatedSavingsRange: 'PHP 1,800-2,800 / month',
    paybackEstimate: 'Needs payment review',
    riskLevel: 'high',
    billUploads: [residentialBill.upload],
    energyProfile: {
      monthlyBill: 4800,
      monthlyKwh: 430,
      billHistory: residentialBill.months,
      annualizedMonthlyBill: residentialBill.averageBill,
      annualizedMonthlyKwh: residentialBill.averageKwh,
      billHistoryMonths: 3,
      billHistoryAnnualized: true,
      daytimeUsage: 'medium',
      operatingHours: 'Evening-heavy household usage',
      brownoutConcern: false,
      batteryInterest: false,
    },
    missingBlockers: ['site-control document', 'valid ID', 'payment preference'],
    nextAction: 'Confirm property authorization and payment preference.',
  });

  const commercialBill = billUpload({
    id: 'bill-demo-commercial-doc-blocked',
    leadId: 'lead-demo-commercial-doc-blocked',
    documentId: 'doc-demo-commercial-bill',
    provider: 'MORE Power',
    billAmount: 95000,
    kwh: 8700,
    confidence: 0.9,
    months: observedBillMonths([91000, 97000, 95000], [8200, 9000, 8700]),
  });
  const commercial = leadFromInput({
    businessName: 'Jaro Print & Packaging',
    contactName: 'Lea Villanueva',
    phone: '09171230003',
    source: 'referral',
    customerType: 'commercial',
    location: 'Jaro, Iloilo City',
    standardizedAddress: 'Jaro, Iloilo City, Philippines',
    latitude: 10.7351,
    longitude: 122.5627,
    utilityProvider: 'MORE Power',
    monthlyBill: 95000,
    monthlyKwh: 8700,
    goal: 'business_continuity',
    siteControl: 'rented_needs_authorization',
    assignedSales: 'sales-1',
    daytimeUsage: 'high',
    brownoutConcern: true,
  }, {
    id: 'lead-demo-commercial-doc-blocked',
    status: 'qualified',
    readinessScore: 74,
    solarFit: 'needs_review',
    recommendedSystemRange: '25-40 kWp',
    estimatedSavingsRange: 'PHP 38,000-60,000 / month',
    paybackEstimate: '3.0-4.5 years',
    riskLevel: 'medium',
    billUploads: [commercialBill.upload],
    energyProfile: {
      monthlyBill: 95000,
      monthlyKwh: 8700,
      billHistory: commercialBill.months,
      annualizedMonthlyBill: commercialBill.averageBill,
      annualizedMonthlyKwh: commercialBill.averageKwh,
      billHistoryMonths: 3,
      billHistoryAnnualized: true,
      daytimeUsage: 'high',
      operatingHours: '8 AM-8 PM production shifts',
      brownoutConcern: true,
      batteryInterest: false,
      currentBackupSetup: 'Diesel genset during outages',
    },
    missingBlockers: ['landlord/site authorization', 'net-metering checklist incomplete'],
    nextAction: 'Upload landlord/site authorization.',
  });

  const coldStorageBill = billUpload({
    id: 'bill-demo-cold-storage',
    leadId: 'lead-demo-cold-storage',
    documentId: 'doc-demo-cold-storage-bill',
    provider: 'MORE Power',
    billAmount: 160000,
    kwh: 14500,
    confidence: 0.94,
    months: observedBillMonths([152000, 166000, 160000], [13700, 15100, 14500]),
  });
  const coldStorage = leadFromInput({
    businessName: 'Atria Cold Storage',
    contactName: 'Joel Tan',
    phone: '09171230004',
    source: 'referral',
    customerType: 'commercial',
    location: 'Mandurriao, Iloilo City',
    standardizedAddress: 'Mandurriao, Iloilo City, Philippines',
    latitude: 10.7204,
    longitude: 122.5487,
    utilityProvider: 'MORE Power',
    monthlyBill: 160000,
    monthlyKwh: 14500,
    goal: 'both',
    siteControl: 'owned',
    assignedSales: 'sales-1',
    daytimeUsage: 'high',
    batteryInterest: true,
    brownoutConcern: true,
  }, {
    id: 'lead-demo-cold-storage',
    status: 'qualified',
    readinessScore: 91,
    solarFit: 'strong',
    recommendedSystemRange: '45-65 kWp',
    estimatedSavingsRange: 'PHP 60,000-92,000 / month',
    paybackEstimate: '3.0-4.0 years',
    riskLevel: 'low',
    billUploads: [coldStorageBill.upload],
    energyProfile: {
      monthlyBill: 160000,
      monthlyKwh: 14500,
      billHistory: coldStorageBill.months,
      annualizedMonthlyBill: coldStorageBill.averageBill,
      annualizedMonthlyKwh: coldStorageBill.averageKwh,
      billHistoryMonths: 3,
      billHistoryAnnualized: true,
      daytimeUsage: 'high',
      operatingHours: '24/7 cold-chain operation',
      brownoutConcern: true,
      batteryInterest: true,
      currentBackupSetup: 'Diesel generator for compressors',
    },
    missingBlockers: ['valid ID pending'],
    nextAction: 'Schedule installer survey for cold-storage validation.',
  });

  const schoolBill = billUpload({
    id: 'bill-demo-school-continuity',
    leadId: 'lead-demo-school-continuity',
    documentId: 'doc-demo-school-bill',
    provider: 'MORE Power',
    billAmount: 62000,
    kwh: 5600,
    confidence: 0.91,
    months: observedBillMonths([59000, 64000, 62000], [5350, 5850, 5600]),
  });
  const school = leadFromInput({
    businessName: 'Iloilo Montessori School',
    contactName: 'Grace Alvarado',
    phone: '09171230005',
    source: 'public_inquiry',
    customerType: 'commercial',
    location: 'Molo, Iloilo City',
    standardizedAddress: 'Molo, Iloilo City, Philippines',
    latitude: 10.7008,
    longitude: 122.5456,
    utilityProvider: 'MORE Power',
    monthlyBill: 62000,
    monthlyKwh: 5600,
    goal: 'business_continuity',
    siteControl: 'owned',
    assignedSales: 'sales-1',
    daytimeUsage: 'high',
    brownoutConcern: true,
  }, {
    id: 'lead-demo-school-continuity',
    status: 'qualified',
    readinessScore: 78,
    solarFit: 'strong',
    recommendedSystemRange: '12-20 kWp',
    estimatedSavingsRange: 'PHP 22,000-34,000 / month',
    paybackEstimate: '3.8-5.2 years',
    riskLevel: 'medium',
    billUploads: [schoolBill.upload],
    energyProfile: {
      monthlyBill: 62000,
      monthlyKwh: 5600,
      billHistory: schoolBill.months,
      annualizedMonthlyBill: schoolBill.averageBill,
      annualizedMonthlyKwh: schoolBill.averageKwh,
      billHistoryMonths: 3,
      billHistoryAnnualized: true,
      daytimeUsage: 'high',
      operatingHours: '7 AM-5 PM school days plus weekend events',
      brownoutConcern: true,
      batteryInterest: false,
      currentBackupSetup: 'UPS for admin office',
    },
    missingBlockers: ['board authorization pending', 'net-metering documents pending'],
    nextAction: 'Validate board authorization and net-metering documents.',
  });

  const waterBill = billUpload({
    id: 'bill-demo-water-refilling-review',
    leadId: 'lead-demo-water-refilling-review',
    documentId: 'doc-demo-water-bill',
    provider: 'MORE Power',
    billAmount: 28000,
    kwh: 2400,
    confidence: 0.86,
    months: observedBillMonths([26500, 29200, 28000], [2250, 2520, 2400]),
  });
  const waterRefilling = leadFromInput({
    businessName: 'Oton Water Refilling Station',
    contactName: 'Nestor Ramos',
    phone: '09171230006',
    source: 'phone',
    customerType: 'commercial',
    location: 'Oton, Iloilo',
    standardizedAddress: 'Oton, Iloilo, Philippines',
    latitude: 10.6927,
    longitude: 122.4731,
    utilityProvider: 'MORE Power',
    monthlyBill: 28000,
    monthlyKwh: 2400,
    goal: 'lower_bill',
    siteControl: 'owned',
    assignedSales: 'sales-1',
    daytimeUsage: 'medium',
  }, {
    id: 'lead-demo-water-refilling-review',
    status: 'captured',
    readinessScore: 66,
    solarFit: 'needs_review',
    recommendedSystemRange: '6-10 kWp',
    estimatedSavingsRange: 'PHP 9,000-14,000 / month',
    paybackEstimate: 'Needs roof review',
    riskLevel: 'medium',
    billUploads: [waterBill.upload],
    energyProfile: {
      monthlyBill: 28000,
      monthlyKwh: 2400,
      billHistory: waterBill.months,
      annualizedMonthlyBill: waterBill.averageBill,
      annualizedMonthlyKwh: waterBill.averageKwh,
      billHistoryMonths: 3,
      billHistoryAnnualized: true,
      daytimeUsage: 'medium',
      operatingHours: '8 AM-7 PM pump and filtration load',
      brownoutConcern: false,
      batteryInterest: false,
    },
    missingBlockers: ['Solar Snapshot manual review', 'financing preference'],
    nextAction: 'Request owner/manager manual Solar Snapshot review.',
  });

  const goldenDeal = deal({
    id: 'deal-demo-golden-msme',
    lead: golden,
    name: 'Iloilo Mini Mart solar lease-to-own',
    value: 780000,
    nextAction: 'Schedule installer survey.',
    blocker: 'Valid ID and site/property proof are pending before proposal.',
    documentStatus: 'pending_validation',
    solarSnapshotStatus: 'ready',
    systemSizeKwp: 12.6,
    paymentOption: 'lease-to-own / installment',
  });

  const commercialDeal = deal({
    id: 'deal-demo-commercial-doc-blocked',
    lead: commercial,
    name: 'Jaro Print & Packaging rooftop project',
    value: 2200000,
    nextAction: 'Upload landlord/site authorization.',
    blocker: 'Site-control authorization is required before dispatch.',
    documentStatus: 'pending_validation',
    solarSnapshotStatus: 'ready',
    systemSizeKwp: 32,
    paymentOption: 'cash or partner financing',
  });

  const coldStorageDeal = deal({
    id: 'deal-demo-cold-storage',
    lead: coldStorage,
    name: 'Atria Cold Storage continuity project',
    value: 3850000,
    nextAction: 'Schedule installer survey for cold-storage validation.',
    blocker: 'Valid ID is pending before proposal.',
    documentStatus: 'pending_validation',
    solarSnapshotStatus: 'ready',
    systemSizeKwp: 56,
    paymentOption: 'partner financing with brownout resiliency option',
  });

  const schoolDeal = deal({
    id: 'deal-demo-school-continuity',
    lead: school,
    name: 'Iloilo Montessori continuity project',
    value: 1080000,
    nextAction: 'Validate board authorization and net-metering documents.',
    blocker: 'Board authorization and net-metering documents are pending.',
    documentStatus: 'pending_validation',
    solarSnapshotStatus: 'ready',
    systemSizeKwp: 16,
    paymentOption: 'installment after board approval',
  });

  const leads = [golden, residential, commercial, coldStorage, school, waterRefilling];
  const deals = [goldenDeal, commercialDeal, coldStorageDeal, schoolDeal];
  const documents = [
    document({ id: 'doc-demo-golden-bill', leadId: golden.id, dealId: goldenDeal.id, category: 'customer_bill', fileName: 'iloilo-mini-mart-april-2026-bill.svg', label: 'MORE Power Electric Bill', status: 'validated' }),
    document({ id: 'doc-demo-golden-business-permit', leadId: golden.id, dealId: goldenDeal.id, category: 'business_docs', fileName: 'iloilo-mini-mart-business-permit.svg', label: 'Business Permit', status: 'pending_validation' }),
    document({ id: 'doc-demo-golden-valid-id', leadId: golden.id, dealId: goldenDeal.id, category: 'valid_id', fileName: 'iloilo-mini-mart-valid-id.svg', label: 'Valid ID Pending', status: 'pending_validation' }),
    document({ id: 'doc-demo-golden-site-proof', leadId: golden.id, dealId: goldenDeal.id, category: 'site_control_document', fileName: 'iloilo-mini-mart-property-proof.svg', label: 'Site Proof Pending', status: 'pending_validation' }),
    document({ id: 'doc-demo-residential-bill', leadId: residential.id, category: 'customer_bill', fileName: 'maria-santos-april-2026-bill.svg', label: 'MORE Power Electric Bill', status: 'validated' }),
    document({ id: 'doc-demo-commercial-bill', leadId: commercial.id, dealId: commercialDeal.id, category: 'customer_bill', fileName: 'jaro-print-april-2026-bill.svg', label: 'MORE Power Electric Bill', status: 'validated' }),
    document({ id: 'doc-demo-commercial-business-permit', leadId: commercial.id, dealId: commercialDeal.id, category: 'business_docs', fileName: 'jaro-print-business-permit.svg', label: 'Business Permit Uploaded', status: 'validated' }),
    document({ id: 'doc-demo-commercial-valid-id', leadId: commercial.id, dealId: commercialDeal.id, category: 'valid_id', fileName: 'jaro-print-valid-id.svg', label: 'Valid ID Uploaded', status: 'validated' }),
    document({ id: 'doc-demo-cold-storage-bill', leadId: coldStorage.id, dealId: coldStorageDeal.id, category: 'customer_bill', fileName: 'atria-cold-storage-april-2026-bill.svg', label: 'MORE Power Electric Bill', status: 'validated' }),
    document({ id: 'doc-demo-cold-storage-business-permit', leadId: coldStorage.id, dealId: coldStorageDeal.id, category: 'business_docs', fileName: 'atria-cold-storage-business-permit.svg', label: 'Business Permit Uploaded', status: 'validated' }),
    document({ id: 'doc-demo-cold-storage-site-proof', leadId: coldStorage.id, dealId: coldStorageDeal.id, category: 'site_control_document', fileName: 'atria-cold-storage-property-proof.svg', label: 'Owned Property Proof', status: 'validated' }),
    document({ id: 'doc-demo-cold-storage-valid-id', leadId: coldStorage.id, dealId: coldStorageDeal.id, category: 'valid_id', fileName: 'atria-cold-storage-valid-id.svg', label: 'Valid ID Pending', status: 'pending_validation' }),
    document({ id: 'doc-demo-school-bill', leadId: school.id, dealId: schoolDeal.id, category: 'customer_bill', fileName: 'iloilo-montessori-april-2026-bill.svg', label: 'MORE Power Electric Bill', status: 'validated' }),
    document({ id: 'doc-demo-school-board-authorization', leadId: school.id, dealId: schoolDeal.id, category: 'site_control_document', fileName: 'iloilo-montessori-board-authorization.svg', label: 'Board Authorization Pending', status: 'pending_validation' }),
    document({ id: 'doc-demo-school-business-docs', leadId: school.id, dealId: schoolDeal.id, category: 'business_docs', fileName: 'iloilo-montessori-school-permit.svg', label: 'School Permit Uploaded', status: 'validated' }),
    document({ id: 'doc-demo-water-bill', leadId: waterRefilling.id, category: 'customer_bill', fileName: 'oton-water-april-2026-bill.svg', label: 'MORE Power Electric Bill', status: 'validated' }),
  ];

  const solarSnapshots = [
    solar({
      id: 'solar-demo-golden-msme',
      lead: golden,
      dealId: goldenDeal.id,
      status: 'ready',
      imageryQuality: 'HIGH',
      roofCapacityKwp: 27,
      maxPanels: 45,
      selectedPanelCount: 21,
      selectedSystemSizeKwp: 12.6,
      annualProductionKwh: 18800,
      nextAction: 'Schedule installer survey.',
    }),
    solar({
      id: 'solar-demo-residential-blocked',
      lead: residential,
      status: 'low_quality',
      imageryQuality: 'MEDIUM',
      roofCapacityKwp: 8,
      maxPanels: 14,
      selectedPanelCount: 5,
      selectedSystemSizeKwp: 2.9,
      annualProductionKwh: 4200,
      nextAction: 'Confirm property authorization and payment preference.',
      riskFlags: ['Manual roof review needed before dispatch.'],
    }),
    solar({
      id: 'solar-demo-commercial-doc-blocked',
      lead: commercial,
      dealId: commercialDeal.id,
      status: 'ready',
      imageryQuality: 'HIGH',
      roofCapacityKwp: 55,
      maxPanels: 90,
      selectedPanelCount: 58,
      selectedSystemSizeKwp: 35.38,
      annualProductionKwh: 51500,
      nextAction: 'Upload landlord/site authorization.',
      riskFlags: ['Site-control authorization required before dispatch.'],
    }),
    solar({
      id: 'solar-demo-cold-storage',
      lead: coldStorage,
      dealId: coldStorageDeal.id,
      status: 'ready',
      imageryQuality: 'HIGH',
      roofCapacityKwp: 82,
      maxPanels: 136,
      selectedPanelCount: 93,
      selectedSystemSizeKwp: 56,
      annualProductionKwh: 81200,
      nextAction: 'Schedule installer survey for cold-storage validation.',
      riskFlags: ['Verify structural loading for compressors and large roof spans.'],
    }),
    solar({
      id: 'solar-demo-school-continuity',
      lead: school,
      dealId: schoolDeal.id,
      status: 'ready',
      imageryQuality: 'HIGH',
      roofCapacityKwp: 35,
      maxPanels: 58,
      selectedPanelCount: 27,
      selectedSystemSizeKwp: 16.3,
      annualProductionKwh: 23600,
      nextAction: 'Validate board authorization and net-metering documents.',
      riskFlags: ['School board authorization must be validated before proposal.'],
    }),
    solar({
      id: 'solar-demo-water-refilling-review',
      lead: waterRefilling,
      status: 'low_quality',
      imageryQuality: 'LOW',
      roofCapacityKwp: 11,
      maxPanels: 18,
      selectedPanelCount: 11,
      selectedSystemSizeKwp: 6.7,
      annualProductionKwh: 9400,
      nextAction: 'Request owner/manager manual Solar Snapshot review.',
      riskFlags: ['Imagery is low quality; owner/manager dispatch override is required.'],
    }),
  ];

  const timelineEvents = [
    timeline('timeline-demo-golden-lead', 'lead', golden.id, 'Demo lead loaded', 'Best-fit MSME with OCR, Solar Snapshot, and pending documents.'),
    timeline('timeline-demo-golden-deal', 'deal', goldenDeal.id, 'Solar Snapshot reviewed', 'Roof capacity supports a 10-15 kWp recommended system.'),
    timeline('timeline-demo-residential-lead', 'lead', residential.id, 'Demo lead loaded', 'Residential lead kept blocked by authorization and payment uncertainty.'),
    timeline('timeline-demo-commercial-lead', 'lead', commercial.id, 'Demo lead loaded', 'High-value commercial lead blocked by lease authorization.'),
    timeline('timeline-demo-commercial-deal', 'deal', commercialDeal.id, 'Document blocker recorded', 'Landlord/site authorization is still required.'),
    timeline('timeline-demo-cold-storage-lead', 'lead', coldStorage.id, 'Demo lead loaded', 'Large cold-storage MSME with high daytime load and backup-power pain.'),
    timeline('timeline-demo-cold-storage-deal', 'deal', coldStorageDeal.id, 'Solar Snapshot reviewed', 'Roof capacity supports a 45-65 kWp commercial system range.'),
    timeline('timeline-demo-school-lead', 'lead', school.id, 'Demo lead loaded', 'School continuity lead with board authorization and net-metering documents pending.'),
    timeline('timeline-demo-school-deal', 'deal', schoolDeal.id, 'Document blocker recorded', 'Board authorization must be validated before proposal.'),
    timeline('timeline-demo-water-lead', 'lead', waterRefilling.id, 'Demo lead loaded', 'Water-refilling station requires owner/manager manual Solar Snapshot review.'),
  ];

  return { leads, deals, solarSnapshots, documents, timelineEvents };
}
