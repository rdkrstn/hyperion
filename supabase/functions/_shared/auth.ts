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

export function signRemoteToken(token: string, leadId: string, secret: string, expiresAt: Date) {
  const payload = btoa(JSON.stringify({ token, lead_id: leadId, exp: Math.floor(expiresAt.getTime() / 1000), scope: 'remote_intake' }));
  return `${payload}.${btoa(`${token}.${secret}`).replaceAll('=', '')}`;
}

export function verifyRemoteToken(jwt: string, token: string, secret: string, now = new Date()) {
  const [payload, signature] = jwt.split('.');
  if (!payload || !signature) throw new ApiError('forbidden', 'Remote intake JWT is malformed.', 403);
  const claims = JSON.parse(atob(payload)) as { token: string; exp: number; scope: string };
  const expected = btoa(`${claims.token}.${secret}`).replaceAll('=', '');
  if (signature !== expected || claims.token !== token || claims.scope !== 'remote_intake') {
    throw new ApiError('forbidden', 'Remote intake JWT is invalid.', 403);
  }
  if (claims.exp * 1000 < now.getTime()) throw new ApiError('forbidden', 'Remote intake JWT is expired.', 403);
  return claims;
}
