import { describe, expect, it } from 'vitest';
import { seedDeals } from '../data/seed';
import { createCheckoutEstimate } from './checkout';
import { evaluateCheckoutPreflight } from './checkoutPreflight';
import { createComplianceDocuments, defaultComplianceRule } from './compliance';
import { freezeCheckoutEstimate } from './quoteBuilder';
import { buildFinancingPacket, buildNetMeteringWorkflow, calculateReadinessResult, sampleReadinessIntake } from './readiness';

describe('checkout preflight', () => {
  it('requires pre-audit, installer validation, net-metering documents, estimate, and proposal artifacts', () => {
    const blocked = evaluateCheckoutPreflight(seedDeals[1]);

    expect(blocked.readyForContract).toBe(false);
    expect(blocked.blockers.join(' ')).toContain('Installer survey');
  });

  it('turns contract-ready after survey, net-metering, estimate, and frozen proposal are present', () => {
    const readiness = calculateReadinessResult(sampleReadinessIntake);
    const base = {
      ...seedDeals[2],
      readinessIntake: sampleReadinessIntake,
      readinessResult: readiness,
      readinessUploads: [
        { id: 'bill-upload', leadId: seedDeals[2].id, category: 'bill' as const, fileName: 'bill.pdf', storagePath: 'bill.pdf', uploadedAt: 'now' },
      ],
      solarInsights: {
        id: 'solar-ready',
        status: 'ready' as const,
        imageryQuality: 'HIGH' as const,
        maxUsableAreaMeters2: 90,
        historicalIrradiance: 1500,
        roofPitchDegrees: 12,
        roofAreaMeters2: 90,
        maxPanels: 24,
        panelCapacityWatts: 550,
        maxSystemSizeKwp: 13.2,
        roofSegments: [{ pitchDegrees: 12, azimuthDegrees: 180, areaMeters2: 90 }],
        riskFlags: [],
        verifiedAt: 'now',
        createdAt: 'now',
      },
      financingPacket: buildFinancingPacket(sampleReadinessIntake, readiness),
      documents: { electricBills: true, businessRegistration: true, validId: true, locationPin: true, roofAccess: true },
      netMeteringWorkflow: {
        ...buildNetMeteringWorkflow(sampleReadinessIntake, readiness.recommendedSystemSizeKwp),
        status: 'ready_for_lender' as const,
        readyForLenderAt: 'now',
      },
      complianceRule: defaultComplianceRule,
    };
    const estimate = freezeCheckoutEstimate(createCheckoutEstimate(base), 'sales');
    const complianceDocuments = createComplianceDocuments({ deal: { ...base, checkoutEstimate: estimate }, actorRole: 'cs', signerName: 'Maria Santos' });
    const ready = evaluateCheckoutPreflight({
      ...base,
      complianceDocuments,
      checkoutEstimate: estimate,
      proposal: {
        id: 'proposal',
        quoteNumber: 'Q-1',
        systemSizeKwp: base.preAudit!.sizeKwp,
        projectPrice: estimate.total,
        projectedSavings: base.preAudit!.projectedSavings,
        grossMarginPercent: estimate.grossMarginPercent,
        status: 'ready',
      },
    });

    expect(ready.canGenerateQuote).toBe(true);
    expect(ready.readyForContract).toBe(true);
  });
});
