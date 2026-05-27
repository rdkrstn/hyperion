import { describe, expect, it } from 'vitest';
import { canSetRefundStatus } from './refunds';
import type { RefundRecord } from '../types';

const refund: RefundRecord = {
  id: 'refund-1',
  amount: 50000,
  status: 'requested',
  reason: 'Customer cancelled before install.',
  requestedBy: 'cs',
  requestedAt: '2026-05-20 10:00',
  notes: 'Operational ledger only.',
};

describe('refund workflow', () => {
  it('requires owner approval for refund approval and completion', () => {
    expect(canSetRefundStatus(refund, 'cs', 'owner_approved').allowed).toBe(false);
    expect(canSetRefundStatus(refund, 'owner', 'owner_approved').allowed).toBe(true);
    expect(canSetRefundStatus(refund, 'owner', 'completed').allowed).toBe(false);
    expect(canSetRefundStatus({ ...refund, status: 'owner_approved' }, 'cs', 'completed').allowed).toBe(true);
  });
});
