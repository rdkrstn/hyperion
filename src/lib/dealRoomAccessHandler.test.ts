import { describe, expect, it } from 'vitest';
import { createDealRoomAccessHandler, type ClientPortalPayload, type DealRoomAccessOps } from '../../supabase/functions/deal-room-access/handler';

describe('deal-room-access Edge Function handler', () => {
  const portal: ClientPortalPayload = {
    id: 'portal-1',
    dealId: 'deal-1',
    token: 'portal-token',
    status: 'active',
    publicUrl: 'http://local/portal/portal-token',
    sections: {
      readinessScore: 82,
      solarFit: 'Strong fit',
      proposalStatus: 'approved',
      paymentOptions: 'cash',
      netMeteringProgress: 'documents',
    },
    createdAt: 'now',
  };

  it('returns only the public Client Portal payload by token', async () => {
    const ops: DealRoomAccessOps = {
      getClientPortalByToken: async () => portal,
      recordEvent: async (current) => current,
      requestQuote: async (current, input) => ({ ...current, quoteRequest: { status: 'requested', input, requestedAt: 'now' } }),
    };
    const handler = createDealRoomAccessHandler(ops);

    const response = await handler(new Request(`http://local/deal-room-access?token=${portal.token}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token).toBe(portal.token);
    expect(body.sections.readinessScore).toBe(portal.sections.readinessScore);
    expect(body.events).toBeUndefined();
  });

  it('records quote requests through POST without exposing table writes', async () => {
    const ops: DealRoomAccessOps = {
      getClientPortalByToken: async () => portal,
      recordEvent: async (current) => current,
      requestQuote: async (current, input) => ({ ...current, quoteRequest: { status: 'requested', input, requestedAt: 'now' } }),
    };
    const handler = createDealRoomAccessHandler(ops);

    const response = await handler(new Request('http://local/deal-room-access', {
      method: 'POST',
      body: JSON.stringify({ token: portal.token, contactName: 'Maria Santos', phone: '09171234567' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.quoteRequest.status).toBe('requested');
  });
});
