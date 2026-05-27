import { describe, expect, it } from 'vitest';
import { buildQualificationSections, missingQualificationItems, scoreQualification } from './qualificationRules';

describe('qualification rules', () => {
  it('derives checklist state and score from lead intake data', () => {
    const input = {
      contactName: 'Ana',
      phone: '09181234567',
      location: 'Bulacan',
      monthlyBill: 185000,
      goal: 'business_continuity' as const,
      siteControl: 'owned' as const,
      customerType: 'commercial' as const,
      daytimeUsage: 'high' as const,
      batteryInterest: false,
      brownoutConcern: true,
    };

    expect(scoreQualification(input)).toBeGreaterThanOrEqual(90);
    expect(missingQualificationItems(input)).toEqual([]);
    expect(buildQualificationSections(input).every((section) => section.state === 'complete')).toBe(true);
  });

  it('marks missing bill and site-control as blockers inside their sections', () => {
    const sections = buildQualificationSections({
      contactName: 'Ana',
      phone: '09181234567',
      location: 'Bulacan',
      monthlyBill: 0,
      goal: 'lower_bill',
      siteControl: 'unknown',
      customerType: 'commercial',
    });

    expect(sections.find((section) => section.id === 'bill_energy')?.missingItems).toEqual(['bill or estimated bill']);
    expect(sections.find((section) => section.id === 'site_control')?.missingItems).toEqual(['site-control answer']);
  });

  it('treats a confirmed lat/lng pin as location evidence', () => {
    const input = {
      contactName: 'Ana',
      phone: '09181234567',
      location: '',
      latitude: 10.7202,
      longitude: 122.5621,
      monthlyBill: 50000,
      goal: 'lower_bill',
      siteControl: 'owned',
      customerType: 'commercial',
    };

    expect(missingQualificationItems(input)).toEqual([]);
    expect(buildQualificationSections(input).find((section) => section.id === 'site_control')?.missingItems).toEqual([]);
  });
});
