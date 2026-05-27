export type QualificationSectionId = 'inquiry' | 'business_fit' | 'bill_energy' | 'site_control' | 'financing_fit' | 'decision_timeline' | 'documents' | 'notes';
export type QualificationSectionState = 'complete' | 'missing' | 'required' | 'needs_review';

export interface QualificationSection {
  id: QualificationSectionId;
  label: string;
  state: QualificationSectionState;
  required: boolean;
  missingItems: string[];
}

export interface QualificationInput {
  contactName: string;
  phone: string;
  location: string;
  latitude?: number;
  longitude?: number;
  monthlyBill: number;
  monthlyKwh?: number;
  goal: string;
  siteControl: string;
  customerType?: string;
  daytimeUsage?: string;
  batteryInterest?: boolean;
  brownoutConcern?: boolean;
}
