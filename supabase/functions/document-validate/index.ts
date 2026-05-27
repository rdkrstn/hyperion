import { ApiError } from '../_shared/errors.ts';
import { assertRole, loadStaffProfile } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { recalculateLeadReadiness } from '../_shared/readiness.ts';
import { logTimeline } from '../_shared/timeline.ts';
import { createDocumentValidateHandler } from './handler.ts';

const supabase = createSupabaseAdmin();

Deno.serve(async (request) => {
  const profile = request.method === 'OPTIONS'
    ? undefined
    : await loadStaffProfile(supabase, request.headers.get('authorization'));
  if (profile) assertRole(profile.role, ['owner', 'cs']);

  return createDocumentValidateHandler({
    async validateDocument({ fileId, action, reviewerId, notes }) {
      if (!profile) throw new ApiError('forbidden', 'Staff profile is required.', 403);
      if (reviewerId !== profile.id && profile.role !== 'owner') {
        throw new ApiError('forbidden', 'reviewer_id must match the signed-in reviewer.', 403);
      }
      const { data: existing, error: existingError } = await supabase
        .from('documents')
        .select('id,lead_id,deal_id,survey_id,proposal_id,category,file_name')
        .eq('id', fileId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) throw new ApiError('not_found', 'Document not found.', 404);

      const status = action === 'validate' ? 'validated' : 'rejected';
      const { error } = await supabase.from('documents').update({
        status,
        validated_by: profile.id,
        reviewer_notes: notes,
        rejection_reason: action === 'reject' ? notes ?? 'Rejected by reviewer.' : null,
        updated_at: new Date().toISOString(),
      }).eq('id', fileId);
      if (error) throw error;

      const readiness = existing.lead_id ? await recalculateLeadReadiness(supabase, existing.lead_id) : null;
      await logTimeline(supabase, {
        ownerType: 'document',
        ownerId: fileId,
        leadId: existing.lead_id ?? undefined,
        dealId: existing.deal_id ?? undefined,
        documentId: fileId,
        title: action === 'validate' ? 'Document validated' : 'Document rejected',
        description: `${existing.category} ${existing.file_name}: ${notes ?? status}.`,
        actorRole: profile.role,
      });
      return {
        file_id: fileId,
        status,
        readiness,
      };
    },
  })(request);
});
