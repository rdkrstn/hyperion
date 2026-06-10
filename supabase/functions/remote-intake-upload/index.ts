import { ApiError } from '../_shared/errors.ts';
import { verifyRemoteToken } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { safeStoragePath, uploadPrivateObject } from '../_shared/storage.ts';
import { logTimeline } from '../_shared/timeline.ts';
import { createRemoteIntakeUploadHandler } from './handler.ts';

const supabase = createSupabaseAdmin();
const remoteSecret = Deno.env.get('REMOTE_INTAKE_JWT_SECRET');
if (!remoteSecret) throw new Error('REMOTE_INTAKE_JWT_SECRET is required.');

function decodeBase64(base64: string) {
  const binary = atob(base64.includes(',') ? base64.split(',').pop() ?? '' : base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

Deno.serve(createRemoteIntakeUploadHandler({
  async recordUpload({ token, accessJwt, category, fileName, mimeType, base64 }) {
    if (!base64) throw new ApiError('bad_request', 'base64 file payload is required.', 400);
    await verifyRemoteToken(accessJwt, token, remoteSecret);
    const { data: intakeToken, error } = await supabase
      .from('remote_intake_tokens')
      .select('id,lead_id,deal_id,status,allowed_categories,expires_at')
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
    if (!intakeToken.allowed_categories.includes(category)) {
      throw new ApiError('forbidden', `Remote intake token does not allow ${category}.`, 403);
    }

    const safeFileName = fileName.replace(/[^\w.\-]+/g, '_');
    const storagePath = safeStoragePath(intakeToken.lead_id, 'remote-intake', category, `${crypto.randomUUID()}-${safeFileName}`);
    await uploadPrivateObject(supabase, 'readiness-uploads', storagePath, decodeBase64(base64), mimeType);

    const { data: document, error: documentError } = await supabase.from('documents').insert({
      lead_id: intakeToken.lead_id,
      deal_id: intakeToken.deal_id,
      category,
      file_name: safeFileName,
      mime_type: mimeType,
      bucket: 'readiness-uploads',
      storage_path: storagePath,
      status: 'needs_review',
    }).select('id').single();
    if (documentError) throw documentError;

    await supabase.from('remote_intake_tokens').update({ status: 'pending_validation', updated_at: new Date().toISOString() }).eq('id', intakeToken.id);
    await logTimeline(supabase, {
      ownerType: 'lead',
      ownerId: intakeToken.lead_id,
      leadId: intakeToken.lead_id,
      dealId: intakeToken.deal_id ?? undefined,
      documentId: document.id,
      title: 'Remote document uploaded',
      description: `${category.replaceAll('_', ' ')} uploaded and awaiting validation.`,
      actorRole: 'client',
    });

    let triggeredOcr = false;
    if (category === 'customer_bill') {
      const { error: ocrError } = await supabase.functions.invoke('bill-ocr-preaudit', {
        body: {
          lead_id: intakeToken.lead_id,
          storagePath,
          fileName: safeFileName,
        },
      });
      triggeredOcr = !ocrError;
    }

    return {
      document_id: document.id,
      status: 'needs_review' as const,
      triggered_ocr: triggeredOcr,
    };
  },
}));
