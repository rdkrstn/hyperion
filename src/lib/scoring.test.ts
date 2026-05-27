import { describe, expect, it } from 'vitest';
import { calculatePreAudit, scoreLead } from './scoring';
import { sampleLeadInput } from '../data/seed';

describe('solar pre-audit scoring', () => {
  it('calculates the sample lead audit snapshot from editable assumptions', () => {
    const audit = calculatePreAudit(sampleLeadInput);

    expect(audit.monthlyKwh).toBeCloseTo(4363.64, 2);
    expect(audit.sizeKwp).toBe(24);
    expect(audit.projectedSavings).toBe(24684);
    expect(audit.capex).toBe(1320000);
    expect(audit.paybackYears).toBeCloseTo(4.46, 2);
  });

  it('routes strong MSME buyers to partner loan and weak leads to nurture', () => {
    const strong = scoreLead(sampleLeadInput);
    const weak = scoreLead({
      ...sampleLeadInput,
      averageMonthlyBill: 6000,
      propertyControl: 'Rents / no authorization yet',
      yearsInBusiness: 'Less than 2 years',
      revenueBand: 'Below ₱150k / month',
      paymentBehavior: 'Unknown',
      purchaseTimeline: 'Just researching',
      interestLevel: 'Curious / price checking',
      businessType: 'Residential only',
    });

    expect(strong.score).toBe(96);
    expect(strong.lane).toBe('partner_loan');
    expect(weak.score).toBeLessThan(40);
    expect(weak.lane).toBe('nurture');
  });
});
