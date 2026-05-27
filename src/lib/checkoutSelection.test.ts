import { describe, expect, it } from 'vitest';
import { seedDeals } from '../data/seed';
import { selectCheckoutDeal } from './checkoutSelection';

describe('checkout route selection', () => {
  it('uses the routed deal before the globally selected deal', () => {
    const selected = selectCheckoutDeal({
      deals: seedDeals,
      selectedDealId: seedDeals[4].id,
      routedDealId: seedDeals[2].id,
    });

    expect(selected?.id).toBe(seedDeals[2].id);
  });

  it('uses the routed deal even when checkout blockers still exist', () => {
    const selected = selectCheckoutDeal({
      deals: seedDeals,
      selectedDealId: seedDeals[3].id,
      routedDealId: seedDeals[1].id,
    });

    expect(selected?.id).toBe(seedDeals[1].id);
  });

  it('falls back to the selected eligible deal when no route id exists', () => {
    const selected = selectCheckoutDeal({
      deals: seedDeals,
      selectedDealId: seedDeals[3].id,
    });

    expect(selected?.id).toBe(seedDeals[3].id);
  });
});
