import { ApiError } from './errors.ts';

export type StaffRole = 'owner' | 'manager' | 'sales' | 'cs' | 'installer';

export interface StaffProfile {
  id: string;
  user_id?: string;
  role: StaffRole;
  active: boolean;
}

export function assertRole(role: StaffRole | undefined, allowed: StaffRole[]) {
  if (!role || !allowed.includes(role)) {
    throw new ApiError('forbidden', `Requires one of: ${allowed.join(', ')}.`, 403);
  }
}

export async function loadStaffProfile(
  supabase: { auth: { getUser: (jwt: string) => Promise<{ data: { user: { id: string } | null }, error: unknown }> }, from: (table: string) => any },
  authorization: string | null,
) {
  const jwt = authorization?.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) throw new ApiError('forbidden', 'Staff authorization token is required.', 403);
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) throw new ApiError('forbidden', 'Invalid staff authorization token.', 403);
  const { data: profile, error: profileError } = await supabase
    .from('staff_profiles')
    .select('id,user_id,role,active')
    .eq('user_id', data.user.id)
    .eq('active', true)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new ApiError('forbidden', 'Active staff profile is required.', 403);
  return profile as StaffProfile;
}

export interface RemoteTokenClaims {
  token: string;
  lead_id: string;
  exp: number;
  scope: 'remote_intake';
}

function base64UrlEncode(input: string | Uint8Array) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string) {
  const padded = input.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  return new Uint8Array([...binary].map((char) => char.charCodeAt(0)));
}

async function hmacSha256(data: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
}

export async function signRemoteToken(token: string, leadId: string, secret: string, expiresAt: Date) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({
    token,
    lead_id: leadId,
    exp: Math.floor(expiresAt.getTime() / 1000),
    scope: 'remote_intake',
  } satisfies RemoteTokenClaims));
  const body = `${header}.${payload}`;
  const signature = base64UrlEncode(await hmacSha256(body, secret));
  return `${body}.${signature}`;
}

export async function verifyRemoteToken(jwt: string, token: string, secret: string, now = new Date()) {
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new ApiError('forbidden', 'Remote intake JWT is malformed.', 403);
  const [header, payload, signature] = parts;
  const expected = base64UrlEncode(await hmacSha256(`${header}.${payload}`, secret));
  if (signature !== expected) throw new ApiError('forbidden', 'Remote intake JWT is invalid.', 403);

  try {
    const decodedHeader = JSON.parse(new TextDecoder().decode(base64UrlDecode(header))) as { alg?: string; typ?: string };
    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as RemoteTokenClaims;
    if (decodedHeader.alg !== 'HS256' || decodedHeader.typ !== 'JWT') {
      throw new ApiError('forbidden', 'Remote intake JWT is invalid.', 403);
    }
    if (claims.token !== token || claims.scope !== 'remote_intake') {
      throw new ApiError('forbidden', 'Remote intake JWT is invalid.', 403);
    }
    if (claims.exp * 1000 < now.getTime()) throw new ApiError('forbidden', 'Remote intake JWT is expired.', 403);
    return claims;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('forbidden', 'Remote intake JWT is malformed.', 403);
  }
}
