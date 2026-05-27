import type { QualificationSection } from '../qualification/types';

export type LeadSource = 'public_inquiry' | 'd2d' | 'remote_intake' | 'referral' | 'phone' | 'messenger' | 'manual';
export type LeadStatus = 'captured' | 'qualified' | 'deal_created' | 'archived';
export type CustomerType = 'residential' | 'commercial' | 'construction' | 'real_estate' | 'property_group';
export type LeadGoal = 'lower_bill' | 'brownout_protection' | 'both' | 'green_property_upgrade' | 'business_continuity';
export type SiteControl = 'owned' | 'leased_with_authorization' | 'rented_needs_authorization' | 'unknown';

export interface BillHistoryMonth {
  periodLabel: string;
  billAmount: number;
  kwh?: number;
  source: 'observed' | 'annualized';
}

export interface BillUpload {
  id: string;
  leadId: string;
  documentId?: string;
  status: 'pending_upload' | 'uploaded' | 'ocr_completed' | 'manual_review';
  extractedMonthlyKwh?: number;
  extractedBillAmount?: number;
  billingPeriod?: string;
  accountName?: string;
  provider?: string;
  confidence?: number;
  ocrProvider?: 'gemini' | 'google_vision' | 'manual';
  monthlySeries?: BillHistoryMonth[];
  annualized?: boolean;
  sourceMonthCount?: number;
}

export interface EnergyProfile {
  monthlyBill: number;
  monthlyKwh?: number;
  billHistory?: BillHistoryMonth[];
  annualizedMonthlyBill?: number;
  annualizedMonthlyKwh?: number;
  billHistoryMonths?: number;
  billHistoryAnnualized?: boolean;
  daytimeUsage: 'low' | 'medium' | 'high' | 'unknown';
  operatingHours: string;
  brownoutConcern: boolean;
  batteryInterest: boolean;
  currentBackupSetup?: string;
}

export interface SiteProfile {
  location: string;
  standardizedAddress?: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
  utilityProvider?: string;
  siteControl: SiteControl;
}

export interface LeadInput {
  businessName: string;
  contactName: string;
  phone: string;
  email?: string;
  source: LeadSource;
  customerType?: CustomerType;
  location: string;
  standardizedAddress?: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
  utilityProvider?: string;
  monthlyBill: number;
  monthlyKwh?: number;
  goal: LeadGoal;
  siteControl: SiteControl;
  assignedSales: string;
  daytimeUsage?: EnergyProfile['daytimeUsage'];
  operatingHours?: string;
  batteryInterest?: boolean;
  brownoutConcern?: boolean;
  expectedCloseDate?: string;
}

export interface LeadRecord {
  id: string;
  status: LeadStatus;
  businessName: string;
  contactName: string;
  phone: string;
  email?: string;
  source: LeadSource;
  customerType: CustomerType;
  assignedSales: string;
  goal: LeadGoal;
  readinessScore: number;
  solarFit: 'strong' | 'needs_review' | 'nurture';
  recommendedSystemRange: string;
  estimatedSavingsRange: string;
  paybackEstimate: string;
  riskLevel: 'low' | 'medium' | 'high';
  qualificationSections: QualificationSection[];
  qualificationOverride?: {
    reason: string;
    actorId?: string;
    createdAt: string;
  };
  billUploads: BillUpload[];
  energyProfile: EnergyProfile;
  siteProfile: SiteProfile;
  missingBlockers: string[];
  nextAction: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface LeadSnapshot {
  leadId: string;
  businessName: string;
  contactName: string;
  location: string;
  monthlyBill: number;
  goal: LeadGoal;
  siteControl: SiteControl;
  readinessScore: number;
}
