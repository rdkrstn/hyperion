import { ApiError } from './errors.ts';

export function safeStoragePath(...parts: string[]) {
  const path = parts
    .map((part) => part.trim().replace(/\\/g, '/').replace(/\.\./g, '').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
  if (!path) throw new ApiError('bad_request', 'Storage path cannot be empty.');
  return path;
}

export async function downloadPrivateObject(supabase: { storage: any }, bucket: string, storagePath: string) {
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) throw error ?? new ApiError('not_found', 'Storage object not found.', 404);
  return data;
}

export async function uploadPrivateObject(supabase: { storage: any }, bucket: string, storagePath: string, body: Blob | Uint8Array, contentType: string) {
  const { error } = await supabase.storage.from(bucket).upload(storagePath, body, { contentType, upsert: false });
  if (error) throw error;
  return { bucket, storagePath };
}
