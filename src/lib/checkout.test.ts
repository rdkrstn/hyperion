import { describe, expect, it } from 'vitest';
import {
  calculateBillingAmount,
  calculateEstimateTotal,
  contractTermsForLane,
  createCheckoutEstimate,
  createContractRecord,
  createMockBillingTransaction,
  createAcceptedInvoice,
} from './checkout';
import { seedDeals } from '../data/seed';

describe('checkout estimate and billing', () => {
  it('builds standard solar package lines that match the estimate total', () => {
    const deal = seedDeals[2];
    const estimate = createCheckoutEstimate(deal);

    expect(estimate.lineItems.map((item) => item.category)).toEqual(['panel', 'inverter', 'mounting', 'electrical', 'permit', 'labor', 'adder']);
    expect(calculateEstimateTotal(estimate.lineItems)).toBe(estimate.total);
    expect(estimate.billingAmount).toBe(calculateBillingAmount(estimate.total, 'deposit'));
  });

  it('caps staff-selected custom billing amount at the project total', () => {
    expect(calculateBillingAmount(100000, 'custom', 150000)).toBe(100000);
    expect(calculateBillingAmount(100000, 'custom', -500)).toBe(0);
  });

  it('uses lane-specific contract terms', () => {
    const deal = seedDeals[2];
    const estimate = createCheckoutEstimate(deal, { paymentMethod: 'partner_loan' });
    const terms = contractTermsForLane('partner_loan', estimate);

    expect(terms.join(' ')).toContain('Partner-loan lane');
    expect(terms.join(' ')).toContain('Partner loan');
  });

  it('creates mocked invoice and billing transaction after contract acceptance', () => {
    const deal = seedDeals[2];
    const estimate = createCheckoutEstimate(deal, { paymentMethod: 'gcash_maya', billingAmountType: 'milestone' });
    const contract = createContractRecord(deal, estimate);
    const invoice = createAcceptedInvoice(deal, contract, estimate);
    const billing = createMockBillingTransaction(invoice, contract, estimate);

    expect(invoice.contractId).toBe(contract.id);
    expect(invoice.amount).toBe(estimate.billingAmount);
    expect(invoice.billingStatus).toBe('mock_succeeded');
    expect(billing.provider).toBe('mock');
    expect(billing.paymentMethod).toBe('gcash_maya');
  });
});
