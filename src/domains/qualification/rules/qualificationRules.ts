import type { QualificationInput, QualificationSection, QualificationSectionId } from '../types';

const sectionLabels: Record<QualificationSectionId, string> = {
  inquiry: 'Inquiry',
  business_fit: 'Business fit',
  bill_energy: 'Bill / energy',
  site_control: 'Site control',
  financing_fit: 'Financing fit',
  decision_timeline: 'Decision / timeline',
  documents: 'Documents',
  notes: 'Notes',
};

const requiredSections: QualificationSectionId[] = ['inquiry', 'bill_energy', 'site_control', 'decision_timeline'];

function hasConfirmedLocation(input: QualificationInput) {
  return Boolean(input.location?.trim()) || (Number.isFinite(input.latitude) && Number.isFinite(input.longitude));
}

export function scoreQualification(input: QualificationInput) {
  let score = 20;
  if (input.contactName && input.phone) score += 10;
  if (hasConfirmedLocation(input)) score += 10;
  if (input.monthlyBill >= 30000 || (input.monthlyKwh ?? 0) >= 350) score += 20;
  if (input.goal) score += 10;
  if (input.siteControl === 'owned' || input.siteControl === 'leased_with_authorization') score += 15;
  if (input.daytimeUsage === 'high') score += 10;
  if (input.batteryInterest || input.brownoutConcern) score += 5;
  return Math.min(score, 100);
}

export function missingQualificationItems(input: QualificationInput) {
  return [
    input.contactName && input.phone ? '' : 'contact',
    hasConfirmedLocation(input) ? '' : 'location or confirmed pin',
    input.monthlyBill || input.monthlyKwh ? '' : 'bill or estimated bill',
    input.goal ? '' : 'goal',
    input.siteControl && input.siteControl !== 'unknown' ? '' : 'site-control answer',
  ].filter(Boolean);
}

export function buildQualificationSections(input: QualificationInput): QualificationSection[] {
  const sectionMissing: Record<QualificationSectionId, string[]> = {
    inquiry: [input.contactName && input.phone ? '' : 'contact'].filter(Boolean),
    business_fit: [input.customerType ? '' : 'customer type'].filter(Boolean),
    bill_energy: [input.monthlyBill || input.monthlyKwh ? '' : 'bill or estimated bill'].filter(Boolean),
    site_control: [hasConfirmedLocation(input) ? '' : 'location or confirmed pin', input.siteControl && input.siteControl !== 'unknown' ? '' : 'site-control answer'].filter(Boolean),
    financing_fit: [],
    decision_timeline: [input.goal ? '' : 'goal'].filter(Boolean),
    documents: input.monthlyBill || input.monthlyKwh ? [] : ['customer bill'],
    notes: [],
  };

  return (Object.keys(sectionLabels) as QualificationSectionId[]).map((id) => ({
    id,
    label: sectionLabels[id],
    required: requiredSections.includes(id),
    missingItems: sectionMissing[id],
    state: sectionMissing[id].length ? (requiredSections.includes(id) ? 'required' : 'missing') : 'complete',
  }));
}
