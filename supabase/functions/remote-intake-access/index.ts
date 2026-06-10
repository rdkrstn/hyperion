import { ApiError } from '../_shared/errors.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { verifyRemoteToken } from '../_shared/auth.ts';
import { logTimeline } from '../_shared/timeline.ts';
import { createRemoteIntakeAccessHandler } from './handler.ts';

const supabase = createSupabaseAdmin();
const remoteSecret = Deno.env.get('REMOTE_INTAKE_JWT_SECRET');
if (!remoteSecret) throw new Error('REMOTE_INTAKE_JWT_SECRET is required.');

Deno.serve(createRemoteIntakeAccessHandler({
  async loadPublicPayload({ token, accessJwt }) {
    await verifyRemoteToken(accessJwt, token, remoteSecret);
    const { data: intakeToken, error } = await supabase
      .from('remote_intake_tokens')
      .select('id,lead_id,deal_id,token,status,allowed_categories,expires_at')
      .eq('token', token)
      .maybeSingle();
    if (error) throw error;
    if (!intakeToken) throw new ApiError('not_found', 'Remote intake token not found.', 404);
    if (intakeToken.status === 'paused' || intakeToken.status === 'expired') {
      throw new ApiError('forbidden', 'Remote intake link is not active.', 403);
    }
    if (new Date(intakeToken.expires_at).getTime() < Date.now()) {
      await supabase.from('remote_intake_tokens').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', intakeToken.id);
      throw new ApiError('forbidden', 'Remote intake link has expired.', 403);
    }
    const { data: documents, error: documentsError } = await supabase
      .from('documents')
      .select('category,file_name,created_at')
      .eq('lead_id', intakeToken.lead_id)
      .in('category', intakeToken.allowed_categories);
    if (documentsError) throw documentsError;
    await logTimeline(supabase, {
      ownerType: 'lead',
      ownerId: intakeToken.lead_id,
      leadId: intakeToken.lead_id,
      dealId: intakeToken.deal_id ?? undefined,
      title: 'Remote intake opened',
      description: 'Customer opened the secure remote intake page.',
      actorRole: 'client',
    });
    return {
      lead_id: intakeToken.lead_id,
      deal_id: intakeToken.deal_id ?? undefined,
      token,
      status: intakeToken.status,
      expires_at: intakeToken.expires_at,
      required_uploads: intakeToken.allowed_categories,
      uploads: (documents ?? []).map((document: { category: string; file_name: string; created_at: string }) => ({
        category: document.category,
        file_name: document.file_name,
        uploaded_at: document.created_at,
      })),
    };
  },
}));
