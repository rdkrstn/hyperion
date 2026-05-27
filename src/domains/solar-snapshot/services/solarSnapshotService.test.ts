import { describe, expect, it } from 'vitest';
import { createLeadRecord } from '../../leads/services/leadService';
import { runLocalSolarSnapshot, updatePanelLayout } from './solarSnapshotService';

describe('solar snapshot service', () => {
  it('marks the local Solar Snapshot ready when a confirmed pin exists', () => {
    const lead = createLeadRecord({
      businessName: 'Pinned Factory',
      contactName: 'Ana Cruz',
      phone: '09175550111',
      source: 'd2d',
      location: 'Makati City',
      latitude: 14.5547,
      longitude: 121.0244,
      monthlyBill: 90000,
      goal: 'lower_bill',
      siteControl: 'owned',
      assignedSales: 'sales-1',
    });

    const snapshot = runLocalSolarSnapshot(lead);

    expect(snapshot.status).toBe('ready');
    expect(snapshot.imageryQuality).toBe('HIGH');
    expect(snapshot.latitude).toBe(14.5547);
    expect(snapshot.longitude).toBe(121.0244);
    expect(snapshot.riskFlags).toEqual([]);
  });

  it('initializes a selected panel layout from the bill-based system size', () => {
    const lead = createLeadRecord({
      businessName: 'Panel Shop',
      contactName: 'Leo Santos',
      phone: '09175550222',
      source: 'd2d',
      location: 'Pasig City',
      latitude: 14.5764,
      longitude: 121.0851,
      monthlyBill: 90000,
      goal: 'lower_bill',
      siteControl: 'owned',
      assignedSales: 'sales-1',
    });

    const snapshot = runLocalSolarSnapshot(lead);

    expect(snapshot.selectedPanelCount).toBeGreaterThan(0);
    expect(snapshot.selectedPanelCount).toBeLessThanOrEqual(snapshot.maxPanels);
    expect(snapshot.selectedSystemSizeKwp).toBeCloseTo((snapshot.selectedPanelCount * snapshot.panelCapacityWatts) / 1000, 2);
    expect(snapshot.maxAnnualProductionKwh).toBeGreaterThanOrEqual(snapshot.annualProductionKwh);
    expect(snapshot.panelPlacements).toHaveLength(snapshot.maxPanels);
  });

  it('caps panel allocation at the Solar Snapshot roof maximum', () => {
    const lead = createLeadRecord({
      businessName: 'Roof Cap Cafe',
      contactName: 'Mila Reyes',
      phone: '09175550333',
      source: 'd2d',
      location: 'Quezon City',
      latitude: 14.676,
      longitude: 121.0437,
      monthlyBill: 45000,
      goal: 'lower_bill',
      siteControl: 'owned',
      assignedSales: 'sales-1',
    });
    const snapshot = runLocalSolarSnapshot(lead);

    const updated = updatePanelLayout(snapshot, { panelCount: snapshot.maxPanels + 10, panelCapacityWatts: 600 });

    expect(updated.selectedPanelCount).toBe(snapshot.maxPanels);
    expect(updated.selectedSystemSizeKwp).toBe(Number(((snapshot.maxPanels * 600) / 1000).toFixed(2)));
    expect(updated.annualProductionKwh).toBe(snapshot.maxAnnualProductionKwh);
    expect(updated.riskFlags).toContain('Selected panel count exceeds Solar Snapshot roof maximum.');
  });
});
