import { describe, expect, it } from 'vitest';
import {
  approveQuoteRequest,
  cancelQuoteRequest,
  convertQuoteRequestToCheckout,
  createQuoteRequest,
  rejectQuoteRequest,
} from './quoteRequests';
import { seedDeals } from '../data/seed';

describe('quote requests', () => {
  it('allows sales to request a quote and blocks installer-created requests', () => {
    const deal = { ...seedDeals[0], quoteRequests: [] };

    const created = createQuoteRequest(deal, 'sales', 'Customer asked for a formal quote.');
    const blocked = createQuoteRequest(deal, 'installer', 'Field team should not request quotes.');

    expect(created.ok).toBe(true);
    expect(created.data?.status).toBe('requested');
    expect(blocked.ok).toBe(false);
  });

  it('prevents duplicate open quote requests on the same deal', () => {
    const deal = { ...seedDeals[0], quoteRequests: [] };
    const created = createQuoteRequest(deal, 'sales', 'Customer asked for a formal quote.');
    const duplicate = createQuoteRequest({ ...deal, quoteRequests: [created.data!] }, 'sales', 'Duplicate click.');

    expect(duplicate.ok).toBe(false);
    expect(duplicate.error).toContain('already open');
  });

  it('moves quote requests through approval, rejection, and cancellation states', () => {
    const deal = { ...seedDeals[0], quoteRequests: [] };
    const request = createQuoteRequest(deal, 'sales', 'Needs review.').data!;

    expect(approveQuoteRequest(request, 'sales').data?.status).toBe('approved');
    expect(rejectQuoteRequest(request, 'sales', 'Missing survey.').data?.status).toBe('rejected');
    expect(cancelQuoteRequest(request, 'sales', 'Customer paused.').data?.status).toBe('cancelled');
  });

  it('converts an approved request into checkout only after survey completion', () => {
    const request = createQuoteRequest({ ...seedDeals[2], quoteRequests: [] }, 'sales', 'Ready for checkout.').data!;
    const approved = approveQuoteRequest(request, 'sales').data!;
    const blocked = convertQuoteRequestToCheckout(seedDeals[0], approved, 'sales');
    const converted = convertQuoteRequestToCheckout(seedDeals[2], approved, 'sales');

    expect(blocked.ok).toBe(false);
    expect(converted.ok).toBe(true);
    expect(converted.data?.quoteRequest.status).toBe('converted_to_checkout');
    expect(converted.data?.estimate.dealId).toBe(seedDeals[2].id);
  });
});
