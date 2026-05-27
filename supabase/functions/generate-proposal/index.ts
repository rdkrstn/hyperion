import { ApiError } from '../_shared/errors.ts';
import { assertRole, loadStaffProfile } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { logTimeline } from '../_shared/timeline.ts';
import { createGenerateProposalHandler } from './handler.ts';
import { proposalRequiredDocumentsGate } from './documentGate.ts';

const supabase = createSupabaseAdmin();
const requiredDocumentCategories = ['customer_bill', 'valid_id', 'site_control_document'];

type PricingLine = {
  category: string;
  name: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  estimatedCost: number;
  sourceReason: string;
  notes?: string;
  optional?: boolean;
  manuallyEdited?: boolean;
};

function readLines(pricingInputs: unknown): PricingLine[] {
  const input = pricingInputs as { lines?: PricingLine[] };
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new ApiError('bad_request', 'At least one reviewed quote line is required before proposal generation.', 400);
  }
  return input.lines.map((line, index) => {
    if (!line.category || !line.name || !line.sourceReason) {
      throw new ApiError('bad_request', `Quote line ${index + 1} is missing category, name, or sourceReason.`, 400);
    }
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    const estimatedCost = Number(line.estimatedCost);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new ApiError('bad_request', `Quote line ${index + 1} quantity is invalid.`, 400);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new ApiError('bad_request', `Quote line ${index + 1} unitPrice is invalid.`, 400);
    if (!Number.isFinite(estimatedCost) || estimatedCost < 0) throw new ApiError('bad_request', `Quote line ${index + 1} estimatedCost is invalid.`, 400);
    return { ...line, quantity, unitPrice, estimatedCost, unit: line.unit ?? 'lot' };
  });
}

Deno.serve(async (request) => {
  const profile = request.method === 'OPTIONS'
    ? undefined
    : await loadStaffProfile(supabase, request.headers.get('authorization'));
  if (profile) assertRole(profile.role, ['owner', 'manager', 'sales']);

  return createGenerateProposalHandler({
    async generateProposal({ dealId, systemSizeKwp, paymentOption, pricingInputs }) {
      if (!profile) throw new ApiError('forbidden', 'Staff profile is required.', 403);
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .select('id,lead_id,name,stage')
        .eq('id', dealId)
        .maybeSingle();
      if (dealError) throw dealError;
      if (!deal) throw new ApiError('not_found', 'Deal not found.', 404);

      const { data: snapshot, error: snapshotError } = await supabase
        .from('solar_snapshots')
        .select('id,dispatch_gate,selected_panel_count,selected_system_size_kwp,annual_production_kwh,max_panels,roof_capacity_kwp,imagery_quality')
        .or(`deal_id.eq.${dealId},lead_id.eq.${deal.lead_id}`)
        .order('reviewed_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (snapshotError) throw snapshotError;
      if (!snapshot || !['ready', 'override_approved'].includes(snapshot.dispatch_gate)) {
        throw new ApiError('forbidden', 'Solar Snapshot must be ready or overridden before proposal generation.', 403);
      }
      if (Number(snapshot.selected_panel_count ?? 0) <= 0) {
        throw new ApiError('forbidden', 'A finalized Solar Snapshot panel layout is required before proposal generation.', 403);
      }

      const { data: surveys, error: surveysError } = await supabase
        .from('surveys')
        .select('id,validation_status')
        .eq('deal_id', dealId)
        .eq('validation_status', 'validated')
        .limit(1);
      if (surveysError) throw surveysError;
      if (!surveys?.length) throw new ApiError('forbidden', 'A validated installer survey is required before proposal generation.', 403);

      const { data: documents, error: documentsError } = await supabase
        .from('documents')
        .select('category,status,deal_id,lead_id,file_name')
        .or(`deal_id.eq.${dealId},lead_id.eq.${deal.lead_id}`)
        .in('category', requiredDocumentCategories);
      if (documentsError) throw documentsError;
      const documentGate = proposalRequiredDocumentsGate({
        dealId,
        leadId: deal.lead_id,
        documents: documents ?? [],
      });
      if (!documentGate.allowed) throw new ApiError('forbidden', documentGate.reason, 403);

      const lines = readLines(pricingInputs);
      const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
      const estimatedCost = lines.reduce((sum, line) => sum + line.estimatedCost, 0);
      const grossMarginPercent = subtotal > 0 ? ((subtotal - estimatedCost) / subtotal) * 100 : 0;
      if (grossMarginPercent < 25) {
        throw new ApiError('forbidden', 'Gross margin below 25% requires owner/manager pricing approval before proposal generation.', 403);
      }

      const { data: previous, error: previousError } = await supabase
        .from('proposals')
        .select('revision')
        .eq('deal_id', dealId)
        .order('revision', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (previousError) throw previousError;
      const revision = Number(previous?.revision ?? 0) + 1;
      const contractToken = crypto.randomUUID();
      const { data: proposal, error: proposalError } = await supabase.from('proposals').insert({
        deal_id: dealId,
        revision,
        status: 'frozen',
        system_size_kwp: systemSizeKwp,
        subtotal,
        estimated_cost: estimatedCost,
        gross_margin_percent: grossMarginPercent,
        payment_option: paymentOption,
        contract_token: contractToken,
        frozen_snapshot: {
          deal_id: dealId,
          system_size_kwp: systemSizeKwp,
          subtotal,
          estimated_cost: estimatedCost,
          gross_margin_percent: grossMarginPercent,
          payment_option: paymentOption,
          solar_snapshot: {
            id: snapshot.id,
            roof_capacity_kwp: snapshot.roof_capacity_kwp,
            max_panels: snapshot.max_panels,
            selected_panel_count: snapshot.selected_panel_count,
            selected_system_size_kwp: snapshot.selected_system_size_kwp,
            annual_production_kwh: snapshot.annual_production_kwh,
            imagery_quality: snapshot.imagery_quality,
          },
          lines,
        },
        frozen_at: new Date().toISOString(),
      }).select('id,status,subtotal,gross_margin_percent').single();
      if (proposalError) throw proposalError;

      const { error: lineError } = await supabase.from('quote_line_items').insert(lines.map((line) => {
        const total = line.quantity * line.unitPrice;
        const marginPercent = total > 0 ? ((total - line.estimatedCost) / total) * 100 : 0;
        return {
          proposal_id: proposal.id,
          category: line.category,
          name: line.name,
          quantity: line.quantity,
          unit: line.unit,
          unit_price: line.unitPrice,
          estimated_cost: line.estimatedCost,
          margin_percent: marginPercent,
          total,
          source_reason: line.sourceReason,
          notes: line.notes,
          optional: Boolean(line.optional),
          manually_edited: Boolean(line.manuallyEdited),
        };
      }));
      if (lineError) throw lineError;

      const { error: updateError } = await supabase.from('deals').update({
        stage: 'proposal_built',
        proposal_status: 'frozen',
        value: subtotal,
        next_best_action: 'Share the Client Portal or send the contract for typed acceptance.',
        updated_at: new Date().toISOString(),
      }).eq('id', dealId);
      if (updateError) throw updateError;

      await logTimeline(supabase, {
        ownerType: 'proposal',
        ownerId: proposal.id,
        leadId: deal.lead_id,
        dealId,
        proposalId: proposal.id,
        title: 'Proposal generated',
        description: `Frozen proposal revision ${revision} created at ${grossMarginPercent.toFixed(1)}% margin.`,
        actorRole: profile.role,
      });
      return {
        proposal_id: proposal.id,
        status: proposal.status,
        subtotal: Number(proposal.subtotal),
        gross_margin_percent: Number(proposal.gross_margin_percent),
      };
    },
  })(request);
});
