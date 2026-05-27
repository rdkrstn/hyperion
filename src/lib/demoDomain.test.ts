import { describe, expect, it } from 'vitest';
import { seedDeals } from '../data/seed';
import { createDealRoom } from './dealRoom';
import {
  canCreateDealFromLead,
  clientPortalFromDeal,
  dealRecordFromDeal,
  documentRecordsFromDeal,
  leadRecordFromDeal,
  proposalRecordFromDeal,
  solarSnapshotFromDeal,
  surveyRecordFromDeal,
  timelineFromDeal,
} from './demoDomain';

describe('clean demo domain records', () => {
  it('splits legacy combined records into lead, deal, solar snapshot, survey, proposal, and timeline views', () => {
    const source = {
      ...seedDeals[4],
      dealRoom: createDealRoom(seedDeals[4], 'http://127.0.0.1:5173'),
      geoPin: { latitude: 10.7202, longitude: 122.5621, confidence: 'pin_confirmed' as const },
      solarInsights: {
        id: 'solar-insight-test',
        status: 'ready' as const,
        imageryQuality: 'HIGH' as const,
        maxSystemSizeKwp: 18,
        maxPanels: 40,
        yearlyEnergyDcKwh: 24000,
        roofSegments: [{ pitchDegrees: 12, azimuthDegrees: 180, areaMeters2: 72 }],
        riskFlags: [],
        createdAt: '2026-05-22 09:00',
      },
    };

    const lead = leadRecordFromDeal(source);
    const deal = dealRecordFromDeal(source);
    const snapshot = solarSnapshotFromDeal(source);
    const survey = surveyRecordFromDeal(source);
    const proposal = proposalRecordFromDeal(source);
    const portal = clientPortalFromDeal(source);
    const documents = documentRecordsFromDeal(source);
    const timeline = timelineFromDeal(source);

    expect(lead.id).toBe(source.id);
    expect(lead.businessName).toBe(source.lead.businessName);
    expect(lead.readinessScore).toBeGreaterThanOrEqual(0);
    expect(deal.leadId).toBe(lead.id);
    expect(deal.leadSnapshot.contactName).toBe(source.lead.contactName);
    expect(deal).not.toHaveProperty('lead');
    expect(snapshot?.leadId).toBe(lead.id);
    expect(snapshot?.dealId).toBe(deal.id);
    expect(survey?.dealId).toBe(deal.id);
    expect(proposal?.dealId).toBe(deal.id);
    expect(portal?.dealId).toBe(deal.id);
    expect(documents.every((document) => document.ownerType === 'deal')).toBe(true);
    expect(timeline[0].ownerId).toBe(source.id);
  });

  it('keeps create-deal eligibility inside the lead qualification boundary', () => {
    const qualified = leadRecordFromDeal({
      ...seedDeals[2],
      qualification: { ...seedDeals[2].qualification, status: 'qualified', missingSections: [] },
    });
    const missingSiteControl = { ...qualified, siteControl: '' };

    expect(canCreateDealFromLead(qualified)).toMatchObject({ allowed: true, missing: [] });
    expect(canCreateDealFromLead(missingSiteControl)).toMatchObject({
      allowed: false,
      missing: ['site-control answer'],
    });
  });
});
