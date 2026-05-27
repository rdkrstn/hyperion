import type { Deal, RemoteIntakeJwtClaims, RemoteIntakeLink, RemoteIntakeStatus, RemoteIntakeUploadCategory, Role } from '../types';

export const requiredRemoteIntakeUploadCategories: RemoteIntakeUploadCategory[] = [
  'customer_bill',
  'valid_id',
  'site_control_document',
];

function stamp(now = new Date()) {
  return now.toISOString();
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function event(eventType: RemoteIntakeLink['events'][number]['eventType'], actorRole?: Role) {
  return { id: id('remote-event'), eventType, actorRole, createdAt: stamp() };
}

function statusForUploads(uploads: RemoteIntakeLink['uploads'], fallback: RemoteIntakeStatus): RemoteIntakeStatus {
  const uploaded = new Set(uploads.map((upload) => upload.category));
  return requiredRemoteIntakeUploadCategories.every((category) => uploaded.has(category)) ? 'completed' : fallback;
}

export function createRemoteIntakeLink(deal: Deal, origin = 'http://127.0.0.1:5173', now = new Date()): RemoteIntakeLink {
  const token = `remote-${deal.code.toLowerCase()}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id: id('remote-intake'),
    dealId: deal.id,
    businessName: deal.lead.businessName,
    token,
    publicUrl: `${origin}/remote-intake/${token}`,
    status: 'generated',
    expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
    createdAt: stamp(now),
    uploads: [],
    events: [{ id: id('remote-event'), eventType: 'generated', createdAt: stamp(now) }],
  };
}

export function isRemoteIntakeExpired(link: RemoteIntakeLink, now = new Date()) {
  return new Date(link.expiresAt).getTime() < now.getTime() || link.status === 'expired';
}

export function markRemoteIntakeSent(link: RemoteIntakeLink, actorRole: Role): RemoteIntakeLink {
  const sentAt = stamp();
  return {
    ...link,
    status: statusForUploads(link.uploads, 'sent'),
    sentAt,
    sentByRole: actorRole,
    events: [event('sent', actorRole), ...link.events],
  };
}

export function recordRemoteIntakeUpload(
  link: RemoteIntakeLink,
  category: RemoteIntakeUploadCategory,
  fileName: string,
  uploadedBy: 'remote-client' | Role,
  storagePath = `${link.dealId}/remote-intake/${category}/${fileName}`,
) {
  const uploads = [
    {
      id: id('remote-upload'),
      category,
      fileName,
      storagePath,
      uploadedAt: stamp(),
      uploadedBy,
    },
    ...link.uploads.filter((upload) => upload.category !== category),
  ];
  const status = statusForUploads(uploads, 'pending_upload');
  const nextLink: RemoteIntakeLink = {
    ...link,
    status,
    uploads,
    events: [
      ...(status === 'completed' && link.status !== 'completed' ? [event('completed')] : []),
      event('uploaded'),
      ...link.events,
    ],
  };
  return { link: nextLink, upload: uploads[0] };
}

export function remoteIntakeUploadLabel(category: RemoteIntakeUploadCategory) {
  const labels: Record<RemoteIntakeUploadCategory, string> = {
    customer_bill: 'Electric Bill',
    valid_id: 'Valid ID',
    site_control_document: 'Title / Lease / Authorization',
  };
  return labels[category];
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
    ['sign', 'verify'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
}

export async function signRemoteIntakeJwt(claims: RemoteIntakeJwtClaims, secret: string) {
  if (!secret) throw new Error('REMOTE_INTAKE_JWT_SECRET is required.');
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify(claims));
  const body = `${header}.${payload}`;
  const signature = base64UrlEncode(await hmacSha256(body, secret));
  return `${body}.${signature}`;
}

export async function verifyRemoteIntakeJwt(jwt: string, secret: string, now = new Date()): Promise<RemoteIntakeJwtClaims> {
  if (!secret) throw new Error('REMOTE_INTAKE_JWT_SECRET is required.');
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('Invalid remote intake JWT.');
  const [header, payload, signature] = parts;
  const expected = base64UrlEncode(await hmacSha256(`${header}.${payload}`, secret));
  if (signature !== expected) throw new Error('Remote intake JWT signature is invalid.');
  const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as RemoteIntakeJwtClaims;
  if (claims.scope !== 'remote_intake') throw new Error('Remote intake JWT scope is invalid.');
  if (claims.exp * 1000 < now.getTime()) throw new Error('Remote intake JWT is expired.');
  return claims;
}
