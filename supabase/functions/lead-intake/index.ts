import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { logTimeline } from '../_shared/timeline.ts';
import { recalculateLeadReadiness } from '../_shared/readiness.ts';
import { createLeadIntakeHandler } from './handler.ts';

const supabase = createSupabaseAdmin();

const qualificationSections = [
  ['inquiry', 'Inquiry', true],
  ['business_fit', 'Business fit', false],
  ['bill_energy', 'Bill / energy', true],
  ['site_control', 'Site control', true],
  ['financing_fit', 'Financing fit', false],
  ['decision_timeline', 'Decision / timeline', true],
  ['documents', 'Documents', false],
  ['notes', 'Notes', false],
] as const;

Deno.serve(createLeadIntakeHandler({
  async createLead(input) {
    const { data: lead, error: leadError } = await supabase.from('leads').insert({
      business_name: input.businessName,
      contact_name: input.contactName,
      phone: input.phone,
      email: input.email,
      source: input.source,
      customer_type: input.businessPropertyType,
      goal: input.goal,
      payment_preference: input.paymentPreference,
    }).select('id').single();
    if (leadError) throw leadError;

    const leadId = lead.id as string;
    const responses = await Promise.all([
      supabase.from('lead_site_profiles').insert({
        lead_id: leadId,
        address: input.location,
        property_type: input.businessPropertyType,
        site_control: 'unknown',
      }),
      supabase.from('lead_energy_profiles').insert({
        lead_id: leadId,
        monthly_bill: input.monthlyBillEstimate,
        monthly_kwh: input.monthlyKwh,
      }),
      supabase.from('qualification_sections').insert(qualificationSections.map(([section_key, label, required]) => ({
        lead_id: leadId,
        section_key,
        label,
        required,
        state: required ? 'missing' : 'needs_review',
      }))),
    ]);
    const failed = responses.find((response) => response.error);
    if (failed?.error) throw failed.error;
    await recalculateLeadReadiness(supabase, leadId);
    await logTimeline(supabase, {
      ownerType: 'lead',
      ownerId: leadId,
      leadId,
      title: 'Lead created',
      description: `${input.businessName} submitted ${input.source} intake.`,
      actorRole: input.source === 'public_inquiry' ? 'client' : 'sales',
    });
    return { lead_id: leadId };
  },
}));
