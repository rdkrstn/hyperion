import { describe, expect, it } from 'vitest';
import { createLeadRecord, qualifyLead } from '../../leads/services/leadService';
import { createDealFromLead, getDealPrimaryAction, markDealOutcome, scheduleSurveyGate } from './dealService';

function qualifiedLead() {
  return qualifyLead(createLeadRecord({
    businessName: 'North Luzon Cold Storage',
    contactName: 'Ana Reyes',
    phone: '09181234567',
    source: 'd2d',
    location: 'Bulacan',
    monthlyBill: 185000,
    goal: 'business_continuity',
    siteControl: 'owned',
    assignedSales: 'sales-1',
  }));
}

describe('deal service', () => {
  it('creates many deals from the same qualified lead with immutable lead snapshots', () => {
    const lead = qualifiedLead();
    const first = createDealFromLead(lead, { name: 'Warehouse rooftop', salesOwner: 'sales-1' });
    const second = createDealFromLead(lead, { name: 'Office annex', salesOwner: 'sales-1' });

    expect(first.id).not.toBe(second.id);
    expect(first.leadId).toBe(lead.id);
    expect(second.leadSnapshot.businessName).toBe('North Luzon Cold Storage');
    expect(getDealPrimaryAction(first).label).toBe('Run Solar Snapshot');
  });

  it('blocks survey scheduling until Solar Snapshot is reviewed or an override is approved', () => {
    const deal = createDealFromLead(qualifiedLead(), { name: 'Warehouse rooftop', salesOwner: 'sales-1' });

    expect(scheduleSurveyGate(deal).allowed).toBe(false);
    expect(scheduleSurveyGate({ ...deal, solarSnapshotStatus: 'ready' }).allowed).toBe(true);
    expect(scheduleSurveyGate({ ...deal, dispatchOverrideStatus: 'approved' }).allowed).toBe(true);
  });

  it('marks won and lost as commercial outcomes without changing lead qualification', () => {
    const deal = createDealFromLead(qualifiedLead(), { name: 'Warehouse rooftop', salesOwner: 'sales-1' });

    expect(markDealOutcome(deal, 'lost', 'Customer chose competitor.').status).toBe('lost');
    expect(markDealOutcome(deal, 'won', 'Contract accepted.').stage).toBe('won');
  });
});
