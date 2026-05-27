export interface ReadinessContext {
  monthlyBill?: number;
  monthlyKwh?: number;
  location?: string;
  siteControl?: string;
  goal?: string;
  paymentPreference?: string;
  documentStatuses?: Partial<Record<'customer_bill' | 'valid_id' | 'site_control_document', string>>;
  solarDispatchGate?: string;
}

export function calculateReadiness(context: ReadinessContext) {
  const blockers: string[] = [];
  let score = 20;
  if (context.monthlyBill && context.monthlyBill > 0 || context.monthlyKwh && context.monthlyKwh > 0) score += 25;
  else blockers.push('Needs Bill');
  if (context.location) score += 15;
  else blockers.push('Needs Location');
  if (context.siteControl && context.siteControl !== 'unknown') score += 15;
  else blockers.push('Needs Site Control');
  if (context.goal) score += 10;
  if (context.paymentPreference) score += 10;
  else blockers.push('Needs Financing Info');
  if (context.solarDispatchGate === 'ready' || context.solarDispatchGate === 'override_approved') score += 20;
  else blockers.push('Solar Snapshot Pending');
  if (context.documentStatuses) {
    for (const category of ['customer_bill', 'valid_id', 'site_control_document'] as const) {
      if (context.documentStatuses[category] && context.documentStatuses[category] !== 'validated') blockers.push(`${category.replaceAll('_', ' ')} not validated`);
    }
  }
  const finalScore = Math.max(0, Math.min(100, score - blockers.length * 3));
  return {
    score: finalScore,
    status: finalScore >= 75 && blockers.length === 0 ? 'qualified' : finalScore >= 55 ? 'qualifying' : 'new_inquiry',
    blockers,
    next_best_action: blockers[0] ? `Resolve ${blockers[0]}.` : 'Create or advance deal.',
  };
}

export async function recalculateLeadReadiness(supabase: { from: (table: string) => any }, leadId: string) {
  const [
    { data: lead, error: leadError },
    { data: energy, error: energyError },
    { data: site, error: siteError },
    { data: documents, error: documentsError },
    { data: solar, error: solarError },
  ] = await Promise.all([
    supabase.from('leads').select('id,goal,payment_preference').eq('id', leadId).maybeSingle(),
    supabase.from('lead_energy_profiles').select('monthly_bill,monthly_kwh').eq('lead_id', leadId).maybeSingle(),
    supabase.from('lead_site_profiles').select('address,site_control').eq('lead_id', leadId).maybeSingle(),
    supabase.from('documents').select('category,status').eq('lead_id', leadId),
    supabase.from('solar_snapshots').select('dispatch_gate').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const failed = [leadError, energyError, siteError, documentsError, solarError].find(Boolean);
  if (failed) throw failed;

  const documentStatuses: ReadinessContext['documentStatuses'] = {};
  for (const document of documents ?? []) {
    if (document.category === 'customer_bill' || document.category === 'valid_id' || document.category === 'site_control_document') {
      documentStatuses[document.category] = document.status;
    }
  }

  const readiness = calculateReadiness({
    monthlyBill: Number(energy?.monthly_bill ?? 0),
    monthlyKwh: energy?.monthly_kwh === null || energy?.monthly_kwh === undefined ? undefined : Number(energy.monthly_kwh),
    location: site?.address,
    siteControl: site?.site_control,
    goal: lead?.goal,
    paymentPreference: lead?.payment_preference,
    documentStatuses,
    solarDispatchGate: solar?.dispatch_gate,
  });

  const { error: updateError } = await supabase.from('leads').update({
    readiness_score: readiness.score,
    qualification_status: readiness.status,
    missing_blockers: readiness.blockers,
    next_best_action: readiness.next_best_action,
    updated_at: new Date().toISOString(),
  }).eq('id', leadId);
  if (updateError) throw updateError;
  return readiness;
}
