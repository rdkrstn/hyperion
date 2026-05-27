import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { recalculateLeadReadiness } from '../_shared/readiness.ts';
import { createReadinessScoreHandler } from './handler.ts';

const supabase = createSupabaseAdmin();

Deno.serve(createReadinessScoreHandler({
  recalculateReadiness: (leadId) => recalculateLeadReadiness(supabase, leadId),
}));
