import { ApiError } from '../_shared/errors.ts';
import { loadStaffProfile, assertRole, signRemoteToken } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { logTimeline } from '../_shared/timeline.ts';
import { createRemoteIntakeCreateHandler } from './handler.ts';

const supabase = createSupabaseAdmin();
const remoteSecret = Deno.env.get('REMOTE_INTAKE_JWT_SECRET');
if (!remoteSecret) throw new Error('REMOTE_INTAKE_JWT_SECRET is required.');

Deno.serve(async (request) => {
  const profile = request.method === 'OPTIONS'
    ? undefined
    : await loadStaffProfile(supabase, request.headers.get('authorization'));
  if (profile) assertRole(profile.role, ['owner', 'manager', 'sales', 'cs']);

  return createRemoteIntakeCreateHandler({
    async createRemoteIntake({ leadId, dealId, requestedDocuments, origin }) {
      if (!profile) throw new ApiError('forbidden', 'Staff profile is required.', 403);
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const accessJwt = await signRemoteToken(token, leadId, remoteSecret, expiresAt);
      const allowedCategories = requestedDocuments.length
        ? requestedDocuments
        : ['customer_bill', 'valid_id', 'site_control_document'];
      const { error } = await supabase.from('remote_intake_tokens').insert({
        lead_id: leadId,
        deal_id: dealId,
        token,
        access_jwt: accessJwt,
        status: 'generated',
        allowed_categories: allowedCategories,
        expires_at: expiresAt.toISOString(),
        created_by: profile.id,
      });
      if (error) throw error;
      await logTimeline(supabase, {
        ownerType: dealId ? 'deal' : 'lead',
        ownerId: dealId ?? leadId,
        leadId,
        dealId,
        title: 'Remote intake link created',
        description: `Requested documents: ${allowedCategories.join(', ')}.`,
        actorRole: profile.role,
      });
      return {
        token,
        access_jwt: accessJwt,
        remote_intake_url: `${origin.replace(/\/$/, '')}/remote-intake/${token}?access_jwt=${encodeURIComponent(accessJwt)}`,
        expires_at: expiresAt.toISOString(),
      };
    },
  })(request);
});
