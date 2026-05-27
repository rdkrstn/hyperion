import { describe, expect, it } from 'vitest';
import { buildFinancingPacket, calculateReadinessResult, sampleReadinessIntake } from './readiness';
import { normalizeBillOcrResult, runFieldPreAudit } from './fieldAutomation';

describe('D2D field automation', () => {
  it('normalizes Google Vision OCR output into bill fields with review flags', () => {
    const result = normalizeBillOcrResult({
      text: 'Meralco bill\n12 month average consumption 4,250 kWh\nAmount due PHP 48,500',
      confidence: 0.84,
      provider: 'google_vision',
    });

    expect(result.averageMonthlyKwh).toBe(4250);
    expect(result.monthlyBillAmount).toBe(48500);
    expect(result.utilityProvider).toBe('Meralco');
    expect(result.manualReviewRequired).toBe(false);
  });

  it('blocks pre-audit auto-advance when 12-month kWh is missing or OCR confidence is low', () => {
    const ocrResult = normalizeBillOcrResult({
      text: 'Meralco bill Amount due PHP 48,500',
      confidence: 0.91,
      provider: 'google_vision',
    });
    const readiness = calculateReadinessResult(sampleReadinessIntake);
    const packet = buildFinancingPacket(sampleReadinessIntake, readiness);
    const run = runFieldPreAudit({
      intake: sampleReadinessIntake,
      readiness,
      financingPacket: packet,
      ocrResult,
    });

    expect(ocrResult.manualReviewRequired).toBe(true);
    expect(run.nextStage).toBe('captured');
  });

  it('auto-advances high-readiness field captures to pre-audit done and drafts the packet', () => {
    const readiness = calculateReadinessResult(sampleReadinessIntake);
    const packet = buildFinancingPacket(sampleReadinessIntake, readiness);
    const ocrResult = normalizeBillOcrResult({
      text: 'Meralco bill\n12 month average consumption 4,250 kWh\nAmount due PHP 48,500',
      confidence: 0.84,
      provider: 'google_vision',
    });
    const run = runFieldPreAudit({
      intake: sampleReadinessIntake,
      readiness,
      financingPacket: packet,
      ocrResult,
    });

    expect(readiness.readinessScore).toBeGreaterThan(70);
    expect(run.nextStage).toBe('pre_audit_done');
    expect(run.preAudit.sizeKwp).toBe(readiness.recommendedSystemSizeKwp);
    expect(run.automationEvents.map((event) => event.eventType)).toEqual([
      'lead_captured',
      'bill_uploaded',
      'ocr_completed',
      'pre_audit_completed',
      'packet_drafted',
    ]);
  });
});
