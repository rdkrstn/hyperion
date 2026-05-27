import { describe, expect, it } from 'vitest';
import { seedDeals } from '../data/seed';
import {
  addQuoteLine,
  approvePricing,
  createQuoteDraft,
  freezeCheckoutEstimate,
  updateQuoteLine,
} from './quoteBuilder';

describe('editable quote builder', () => {
  it('creates contextual quote lines from Solar API and pre-audit inputs', () => {
    const draft = createQuoteDraft(seedDeals[2], { paymentMethod: 'bank_transfer' });

    expect(draft.status).toBe('draft');
    expect(draft.lineItems[0].sourceReason).toContain('Solar API');
    expect(draft.lineItems[0].estimatedCost).toBeGreaterThan(0);
    expect(draft.lineItems[0].marginPercent).toBeGreaterThan(0);
  });

  it('marks manual edits and requires approval below 25 percent margin before freeze', () => {
    const draft = createQuoteDraft(seedDeals[2]);
    const edited = updateQuoteLine(draft, draft.lineItems[0].id, {
      unitPrice: 1000,
      notes: 'Customer requested aggressive pricing.',
    });

    expect(edited.lineItems[0].manuallyEdited).toBe(true);
    expect(edited.approvalStatus).toBe('needs_pricing_approval');
    expect(() => freezeCheckoutEstimate(edited, 'sales')).toThrow(/pricing approval/i);

    const approved = approvePricing(edited, 'manager', 'Margin approved for strategic account.');
    const frozen = freezeCheckoutEstimate(approved, 'sales');

    expect(frozen.status).toBe('frozen');
    expect(frozen.pricingApprovedBy).toBe('manager');
  });

  it('supports add/remove-style custom scope lines through the same totals engine', () => {
    const draft = createQuoteDraft(seedDeals[2]);
    const withAdder = addQuoteLine(draft, {
      category: 'adder',
      name: 'Optional monitoring display',
      description: 'Customer-facing monitoring screen.',
      quantity: 1,
      unit: 'lot',
      unitPrice: 35000,
      estimatedCost: 21000,
      sourceReason: 'Sales-added customer request.',
      notes: 'Optional.',
      optional: true,
    });

    expect(withAdder.lineItems.some((item) => item.name === 'Optional monitoring display')).toBe(true);
    expect(withAdder.total).toBeGreaterThan(draft.total);
  });
});
