import { assertRole, loadStaffProfile } from '../_shared/auth.ts';
import { ApiError, jsonError, jsonOk, readJson, requireString } from '../_shared/errors.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { handleCors } from '../_shared/cors.ts';

const supabase = createSupabaseAdmin();

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;
  if (request.method !== 'POST') return jsonError(new ApiError('method_not_allowed', 'Method not allowed.', 405));

  try {
    const profile = await loadStaffProfile(supabase, request.headers.get('authorization'));
    assertRole(profile.role, ['owner', 'manager', 'sales', 'cs', 'installer']);

    const input = await readJson<{ document_id?: string; documentId?: string; expires_in?: number }>(request);
    const documentId = requireString(input.document_id ?? input.documentId, 'document_id');
    const expiresIn = Math.min(Math.max(Number(input.expires_in ?? 300), 60), 900);

    const { data: document, error } = await supabase
      .from('documents')
      .select('id,bucket,storage_path,file_name,lead_id,deal_id,survey_id,proposal_id,client_id')
      .eq('id', documentId)
      .maybeSingle();
    if (error) throw error;
    if (!document) throw new ApiError('not_found', 'Document not found.', 404);

    const { data, error: signedError } = await supabase
      .storage
      .from(document.bucket)
      .createSignedUrl(document.storage_path, expiresIn, { download: document.file_name });
    if (signedError) throw signedError;
    if (!data?.signedUrl) throw new ApiError('internal_error', 'Unable to create signed document URL.', 500);

    return jsonOk({
      document_id: document.id,
      signed_url: data.signedUrl,
      expires_in: expiresIn,
    });
  } catch (error) {
    return jsonError(error);
  }
});
