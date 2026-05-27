import { describe, expect, it } from 'vitest';
import { createContractAccessHandler, type ContractAccessOps, type PublicContract } from '../../supabase/functions/contract-access/handler';

const publicContract: PublicContract = {
  id: 'proposal-1',
  deal_id: 'deal-12345678',
  token: 'token-123',
  status: 'frozen',
  subtotal: 250000,
  payment_option: 'bank_transfer',
  frozen_at: '2026-05-22T00:00:00Z',
  lead_snapshot: {
    businessName: 'Demo Client',
    contactName: 'Demo Buyer',
    location: 'Iloilo',
  },
};

function createOps(contract: PublicContract | null = publicContract) {
  const calls: string[] = [];
  const ops: ContractAccessOps = {
    async loadPublicContract() {
      calls.push('load');
      return contract;
    },
    async insertAcceptance() {
      calls.push('acceptance');
    },
    async insertInvoice() {
      calls.push('invoice');
      return { id: 'invoice-1' };
    },
    async markProposalAccepted() {
      calls.push('signed');
    },
    async markDealAccepted() {
      calls.push('deal');
    },
    async upsertClientFromContract() {
      calls.push('client');
    },
  };
  return { ops, calls };
}

describe('contract access handler', () => {
  it('returns public contract payload for a token', async () => {
    const { ops } = createOps();
    const handler = createContractAccessHandler(ops);
    const response = await handler(new Request('http://local/contract-access?token=token-123'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.contract.id).toBe('proposal-1');
  });

  it('records acceptance, invoice, mocked billing, signed contract, and client link', async () => {
    const { ops, calls } = createOps();
    const handler = createContractAccessHandler(ops);
    const response = await handler(new Request('http://local/contract-access', {
      method: 'POST',
      body: JSON.stringify({ token: 'token-123', signerName: 'Demo Buyer' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.accepted).toBe(true);
    expect(calls).toEqual(['load', 'acceptance', 'invoice', 'signed', 'deal', 'client']);
  });

  it('rejects missing signer names', async () => {
    const { ops } = createOps();
    const handler = createContractAccessHandler(ops);
    const response = await handler(new Request('http://local/contract-access', {
      method: 'POST',
      body: JSON.stringify({ token: 'token-123', signerName: '' }),
    }));

    expect(response.status).toBe(400);
  });
});
