import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';
import { createDealRoomAccessHandler } from './handler.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and a server-side Supabase secret key are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(createDealRoomAccessHandler({
  async getClientPortalByToken(token) {
    const { data, error } = await supabase
      .from('client_portals')
      .select(`
        id,
        deal_id,
        token,
        status,
        public_url,
        created_at,
        deals (
          lead_snapshot,
          proposal_status,
          commercial_packet
        )
      `)
      .eq('token', token)
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    const leadSnapshot = data.deals?.lead_snapshot ?? {};
    const commercialPacket = data.deals?.commercial_packet ?? {};
    return {
      id: data.id,
      dealId: data.deal_id,
      token: data.token,
      status: data.status,
      publicUrl: data.public_url,
      sections: {
        readinessScore: leadSnapshot.readinessScore ?? 0,
        solarFit: leadSnapshot.readinessScore >= 75 ? 'Strong fit' : 'Needs review',
        proposalStatus: data.deals?.proposal_status ?? 'draft',
        paymentOptions: commercialPacket.paymentOption ?? 'cash',
        netMeteringProgress: 'tracked internally',
      },
      createdAt: data.created_at,
    };
  },
  async recordEvent(room, eventType) {
    const patch = eventType === 'viewed' ? { last_viewed_at: new Date().toISOString() } : {};
    const { error } = await supabase.from('client_portals').update(patch).eq('id', room.id);
    if (error) throw error;
    return room;
  },
  async requestQuote(room, input) {
    const { error } = await supabase.from('tickets').insert({
      title: `Client Portal quote request: ${input.contactName}`,
      category: 'proposal',
      status: 'open',
      priority: 'high',
      linked_deal_id: room.dealId,
    });
    if (error) throw error;
    const quoteRequest = { status: 'requested' as const, input, requestedAt: new Date().toISOString() };
    return { ...room, quoteRequest };
  },
}));
