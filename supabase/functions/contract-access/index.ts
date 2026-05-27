import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { logTimeline } from '../_shared/timeline.ts';
import { createContractAccessHandler } from './handler.ts';

const supabase = createSupabaseAdmin();

Deno.serve(createContractAccessHandler({
  async loadPublicContract(token) {
    const { data, error } = await supabase
      .from('proposals')
      .select(`
        id,
        deal_id,
        contract_token,
        status,
        subtotal,
        payment_option,
        frozen_at,
        deals (
          id,
          lead_snapshot
        )
      `)
      .eq('contract_token', token)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      deal_id: data.deal_id,
      token: data.contract_token,
      status: data.status,
      subtotal: Number(data.subtotal ?? 0),
      payment_option: data.payment_option,
      frozen_at: data.frozen_at,
      lead_snapshot: data.deals?.lead_snapshot ?? undefined,
    };
  },

  async insertAcceptance(input) {
    const { error } = await supabase.from('contract_acceptances').insert(input);
    if (error) throw error;
  },

  async insertInvoice(input) {
    const { data, error } = await supabase
      .from('billing_invoices')
      .insert({
        deal_id: input.deal_id,
        proposal_id: input.proposal_id,
        amount: input.amount,
        status: 'issued',
        provider_execution: 'mocked',
      })
      .select('id')
      .single();
    if (error) throw error;
    return data;
  },

  async markProposalAccepted(proposalId, acceptedAt) {
    const { error } = await supabase.from('proposals').update({
      status: 'accepted',
      accepted_at: acceptedAt,
      updated_at: acceptedAt,
    }).eq('id', proposalId);
    if (error) throw error;
  },

  async markDealAccepted(dealId) {
    const { error } = await supabase.from('deals').update({
      stage: 'contract_accepted',
      contract_status: 'signed',
      proposal_status: 'accepted',
      next_best_action: 'Mark deal won and start installation, net-metering, and aftersales work.',
      updated_at: new Date().toISOString(),
    }).eq('id', dealId);
    if (error) throw error;
  },

  async upsertClientFromContract(contract, signerName) {
    const leadSnapshot = contract.lead_snapshot ?? {};
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .upsert({
        deal_id: contract.deal_id,
        business_name: leadSnapshot.businessName ?? 'Signed solar client',
        contact_name: signerName || leadSnapshot.contactName || 'Signed customer',
        location: leadSnapshot.location ?? '',
        status: 'active_client',
      }, { onConflict: 'deal_id' })
      .select('id')
      .single();
    if (clientError) throw clientError;
    await logTimeline(supabase, {
      ownerType: 'deal',
      ownerId: contract.deal_id,
      dealId: contract.deal_id,
      proposalId: contract.id,
      title: 'Contract accepted',
      description: `${signerName} accepted the proposal contract. Client ${client.id} is active.`,
      actorRole: 'client',
    });
  },
}));
