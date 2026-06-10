import { describe, expect, it } from 'vitest';
import { ApiError } from './errors.ts';
import { signRemoteToken, verifyRemoteToken } from './auth.ts';

describe('remote intake token auth', () => {
  it('signs a tamper-resistant three-part JWT scoped to the remote intake token', async () => {
    const expiresAt = new Date('2026-06-12T00:00:00Z');
    const jwt = await signRemoteToken('remote-token-123', 'lead-123', 'super-secret-value', expiresAt);

    expect(jwt.split('.')).toHaveLength(3);
    await expect(verifyRemoteToken(jwt, 'remote-token-123', 'super-secret-value', new Date('2026-06-11T00:00:00Z')))
      .resolves
      .toMatchObject({ token: 'remote-token-123', lead_id: 'lead-123', scope: 'remote_intake' });

    const [header, payload, signature] = jwt.split('.');
    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    const tamperedPayload = base64UrlEncode(JSON.stringify({ ...claims, token: 'remote-token-456' }));

    await expect(verifyRemoteToken(`${header}.${tamperedPayload}.${signature}`, 'remote-token-456', 'super-secret-value', new Date('2026-06-11T00:00:00Z')))
      .rejects
      .toBeInstanceOf(ApiError);
  });

  it('rejects expired remote intake JWTs', async () => {
    const jwt = await signRemoteToken('remote-token-123', 'lead-123', 'super-secret-value', new Date('2026-06-10T00:00:00Z'));

    await expect(verifyRemoteToken(jwt, 'remote-token-123', 'super-secret-value', new Date('2026-06-11T00:00:00Z')))
      .rejects
      .toMatchObject({ code: 'forbidden' });
  });
});

function base64UrlEncode(input: string) {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string) {
  const padded = input.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  return new Uint8Array([...binary].map((char) => char.charCodeAt(0)));
}
