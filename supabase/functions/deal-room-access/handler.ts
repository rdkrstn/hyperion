export interface ClientPortalPayload {
  id: string;
  dealId: string;
  token: string;
  status: 'active' | 'paused' | 'expired';
  publicUrl: string;
  sections: {
    readinessScore: number;
    solarFit: string;
    proposalStatus: string;
    paymentOptions: string;
    netMeteringProgress: string;
  };
  quoteRequest?: {
    status: 'requested';
    input: ClientPortalQuoteRequestInput;
    requestedAt: string;
  };
  createdAt: string;
}

export interface ClientPortalQuoteRequestInput {
  contactName: string;
  phone: string;
  note?: string;
}

export type DealRoomAccessOps = {
  getClientPortalByToken: (token: string) => Promise<ClientPortalPayload | undefined>;
  recordEvent: (portal: ClientPortalPayload, eventType: 'viewed' | 'section_opened', metadata?: Record<string, string | number | boolean | null>) => Promise<ClientPortalPayload>;
  requestQuote: (portal: ClientPortalPayload, input: ClientPortalQuoteRequestInput) => Promise<ClientPortalPayload>;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function createDealRoomAccessHandler(ops: DealRoomAccessOps) {
  return async function handleDealRoomAccess(request: Request) {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
      if (request.method === 'GET') {
        const token = new URL(request.url).searchParams.get('token')?.trim();
        if (!token) return json({ error: 'Token is required.' }, 400);
        const portal = await ops.getClientPortalByToken(token);
        if (!portal || portal.status !== 'active') return json({ error: 'Client Portal is not available.' }, 404);
        await ops.recordEvent(portal, 'viewed');
        return json(publicPayload(portal));
      }

      if (request.method === 'POST') {
        const input = await request.json() as ClientPortalQuoteRequestInput & { token?: string };
        if (!input.token?.trim()) return json({ error: 'Token is required.' }, 400);
        if (!input.contactName?.trim()) return json({ error: 'Contact name is required.' }, 400);
        if (!input.phone?.trim()) return json({ error: 'Phone is required.' }, 400);
        const portal = await ops.getClientPortalByToken(input.token);
        if (!portal || portal.status !== 'active') return json({ error: 'Client Portal is not available.' }, 404);
        const updated = await ops.requestQuote(portal, {
          contactName: input.contactName.trim(),
          phone: input.phone.trim(),
          note: input.note?.trim() || '',
        });
        return json({
          token: updated.token,
          quoteRequest: updated.quoteRequest,
        });
      }

      return json({ error: 'Method not allowed.' }, 405);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Unknown Client Portal error.' }, 500);
    }
  };
}

function publicPayload(room: ClientPortalPayload) {
  return {
    id: room.id,
    token: room.token,
    status: room.status,
    publicUrl: room.publicUrl,
    sections: room.sections,
    quoteRequest: room.quoteRequest,
    createdAt: room.createdAt,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
