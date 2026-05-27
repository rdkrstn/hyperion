import { describe, expect, it } from 'vitest';
import { seedDeals } from '../data/seed';
import {
  complianceSlaStatus,
  createComplianceDocuments,
  defaultComplianceRule,
  evaluateComplianceGate,
  evaluateSolarApiGate,
} from './compliance';

describe('compliance state machine', () => {
  it('calculates deemed approval using working days excluding weekends and holidays', () => {
    const electrical = complianceSlaStatus({
      submittedAt: '2026-05-14T09:00:00+08:00',
      thresholdWorkingDays: 3,
      holidays: ['2026-05-15'],
      now: new Date('2026-05-20T09:00:00+08:00'),
    });

    expect(electrical.workingDays).toBe(3);
    expect(electrical.status).toBe('deemed_approved');
    expect(electrical.badge).toBe('DEEMED APPROVED (RA 11032)');
    expect(electrical.relievesBlocker).toBe(true);
  });

  it('requires generated Annex documents and ready-for-lender state before checkout', () => {
    const deal = {
      ...seedDeals[2],
      complianceRule: defaultComplianceRule,
      netMeteringWorkflow: {
        ...seedDeals[2].netMeteringWorkflow!,
        status: 'compliance_docs_generated' as const,
      },
      complianceDocuments: createComplianceDocuments({ deal: seedDeals[2], actorRole: 'cs', signerName: 'Maria Santos' }),
    };
    const blocked = evaluateComplianceGate(deal);
    const ready = evaluateComplianceGate({
      ...deal,
      netMeteringWorkflow: { ...deal.netMeteringWorkflow, status: 'ready_for_lender' as const, readyForLenderAt: '2026-05-20T09:00:00+08:00' },
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain('ready for lender');
    expect(ready.allowed).toBe(true);
  });

  it('blocks formal quote when Solar API is pending unless owner override exists', () => {
    const blocked = evaluateSolarApiGate({
      ...seedDeals[0],
      solarInsights: { id: 'solar', status: 'maps_pending', roofSegments: [], riskFlags: ['pending'], createdAt: 'now' },
    });
    const override = evaluateSolarApiGate({
      ...seedDeals[0],
      solarInsights: { id: 'solar', status: 'maps_pending', roofSegments: [], riskFlags: ['pending'], ownerOverrideAt: 'now', ownerOverrideReason: 'Manual roof review complete.', createdAt: 'now' },
    });

    expect(blocked.allowed).toBe(false);
    expect(override.allowed).toBe(true);
  });
});
