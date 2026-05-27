import { describe, expect, it } from 'vitest';
import { canCreateDealFromLead, createLeadRecord, qualifyLead } from './leadService';
import { buildLeadDetailModel } from './leadDetailViewService';

describe('lead service', () => {
  it('creates captured leads without seeded deal state', () => {
    const lead = createLeadRecord({
      businessName: 'Santos Bakery',
      contactName: 'Maria Santos',
      phone: '09171234567',
      source: 'd2d',
      location: 'Makati City',
      monthlyBill: 42000,
      goal: 'lower_bill',
      siteControl: 'owned',
      assignedSales: 'sales-1',
    });

    expect(lead.status).toBe('captured');
    expect(lead.readinessScore).toBeGreaterThan(0);
    expect(lead.nextAction).toBe('Complete qualification.');
  });

  it('stores confirmed map pin data on the lead site profile', () => {
    const lead = createLeadRecord({
      businessName: 'Pinned Hardware',
      contactName: 'Jose Reyes',
      phone: '09175550000',
      source: 'd2d',
      location: 'Sta. Rosa, Laguna',
      standardizedAddress: 'Sta. Rosa, Laguna, Philippines',
      placeId: 'place-123',
      latitude: 14.2842,
      longitude: 121.0889,
      monthlyBill: 58000,
      goal: 'business_continuity',
      siteControl: 'leased_with_authorization',
      assignedSales: 'sales-1',
    });

    expect(lead.siteProfile.latitude).toBe(14.2842);
    expect(lead.siteProfile.longitude).toBe(121.0889);
    expect(lead.siteProfile.placeId).toBe('place-123');
    expect(lead.siteProfile.standardizedAddress).toContain('Sta. Rosa');
  });

  it('allows a confirmed pin to stand in for a typed address', () => {
    const lead = createLeadRecord({
      businessName: 'Pinned Sari Sari',
      contactName: 'Lina Cruz',
      phone: '09175550001',
      source: 'd2d',
      location: '',
      latitude: 10.7202,
      longitude: 122.5621,
      monthlyBill: 41000,
      goal: 'lower_bill',
      siteControl: 'owned',
      assignedSales: 'sales-1',
    });

    expect(lead.siteProfile.location).toBe('Pinned location (10.720200, 122.562100)');
    expect(lead.siteProfile.standardizedAddress).toBe('Pinned location (10.720200, 122.562100)');
    expect(canCreateDealFromLead(lead).allowed).toBe(true);
    expect(lead.qualificationSections.find((section) => section.id === 'site_control')?.missingItems).toEqual([]);
  });

  it('requires minimum qualification fields before deal creation unless override is logged', () => {
    const lead = createLeadRecord({
      businessName: 'No Bill Store',
      contactName: 'Owner',
      phone: '09170000000',
      source: 'referral',
      location: 'Quezon City',
      monthlyBill: 0,
      goal: 'lower_bill',
      siteControl: 'owned',
      assignedSales: 'sales-1',
    });

    expect(canCreateDealFromLead(lead)).toEqual({
      allowed: false,
      missing: ['bill or estimated bill'],
    });

    const qualified = qualifyLead(lead, { overrideReason: 'Owner showed the physical bill during D2D visit.' });

    expect(qualified.status).toBe('qualified');
    expect(qualified.qualificationOverride?.reason).toContain('physical bill');
    expect(canCreateDealFromLead(qualified).allowed).toBe(true);
  });

  it('uses monthly kWh as the fallback energy basis when bill amount is not available', () => {
    const lead = createLeadRecord({
      businessName: 'Kwh Only Store',
      contactName: 'Rosa Reyes',
      phone: '09175550002',
      source: 'd2d',
      location: 'Iloilo City',
      monthlyBill: 0,
      monthlyKwh: 1800,
      goal: 'lower_bill',
      siteControl: 'owned',
      assignedSales: 'sales-1',
      daytimeUsage: 'high',
    });

    expect(lead.energyProfile.monthlyKwh).toBe(1800);
    expect(lead.energyProfile.monthlyBill).toBe(19800);
    expect(lead.recommendedSystemRange).not.toBe('Pending bill');
    expect(lead.estimatedSavingsRange).toContain('PHP');
    expect(canCreateDealFromLead(lead).allowed).toBe(true);
  });

  it('uses the stored readiness score for lead detail display instead of recalculating read-only records', () => {
    const lead = {
      ...createLeadRecord({
        businessName: 'Iloilo Mini Mart',
        contactName: 'Ramon Dela Cruz',
        phone: '09171230001',
        source: 'd2d' as const,
        location: 'Santa Barbara, Iloilo',
        monthlyBill: 45000,
        goal: 'both' as const,
        siteControl: 'owned' as const,
        assignedSales: 'sales-1',
        daytimeUsage: 'high' as const,
        batteryInterest: true,
      }),
      readinessScore: 86,
      missingBlockers: ['valid ID pending'],
      nextAction: 'Schedule installer survey.',
    };

    const model = buildLeadDetailModel(lead);

    expect(model.readinessScore).toBe(86);
    expect(model.readinessLabel).toBe('86/100');
    expect(model.estimatedSavingsRange).toBe(lead.estimatedSavingsRange);
    expect(model.nextAction).toBe('Schedule installer survey.');
  });
});
