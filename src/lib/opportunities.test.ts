import { describe, expect, it } from 'vitest';
import { seedDeals } from '../data/seed';
import {
  canSetOpportunityStatus,
  opportunityDealValue,
  opportunityStatusLabels,
} from './opportunities';

describe('opportunity table behavior', () => {
  it('uses the strongest available commercial value for opportunity tables', () => {
    expect(opportunityDealValue(seedDeals[4])).toBe(seedDeals[4].proposal?.projectPrice);
    expect(opportunityDealValue(seedDeals[3])).toBe(seedDeals[3].proposal?.projectPrice);
    expect(opportunityDealValue(seedDeals[2])).toBeGreaterThan(0);
    expect(opportunityDealValue(seedDeals[0])).toBe(0);
  });

  it('supports lost status as a commercial outcome separate from workflow stage', () => {
    expect(opportunityStatusLabels.lost).toBe('Lost');
    expect(canSetOpportunityStatus('sales', 'lost').allowed).toBe(true);
    expect(canSetOpportunityStatus('owner', 'won').allowed).toBe(true);
    expect(canSetOpportunityStatus('cs', 'lost').allowed).toBe(false);
    expect(canSetOpportunityStatus('installer', 'won').allowed).toBe(false);
  });
});
