import { describe, expect, it } from 'vitest';
import { createRemoteIntakeAccessHandler, type RemoteIntakeAccessOps } from '../../supabase/functions/remote-intake-access/handler';

describe('remote intake access Edge Function handler', () => {
  it('returns only the public upload payload for a token/JWT pair', async () => {
    const ops: RemoteIntakeAccessOps = {
      loadPublicPayload: async ({ token }) => ({
        lead_id: 'lead-1',
        token,
        status: 'pending_upload',
        expires_at: '2026-05-24T00:00:00Z',
        required_uploads: ['customer_bill', 'valid_id', 'site_control_document'],
        uploads: [],
      }),
    };
    const handler = createRemoteIntakeAccessHandler(ops);
    const response = await handler(new Request('https://functions.local/remote-intake-access?token=token-1&access_jwt=jwt-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.required_uploads).toContain('valid_id');
    expect(body.data.deals).toBeUndefined();
  });

  it('rejects upload mutations because uploads belong to remote-intake-upload', async () => {
    const handler = createRemoteIntakeAccessHandler({
      loadPublicPayload: async () => {
        throw new Error('should not be called');
      },
    });
    const response = await handler(new Request('https://functions.local/remote-intake-access', { method: 'POST', body: '{}' }));
    const body = await response.json();

    expect(response.status).toBe(405);
    expect(body.error.code).toBe('method_not_allowed');
  });
});
