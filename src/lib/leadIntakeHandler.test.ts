import { describe, expect, it } from 'vitest';
import { createLeadIntakeHandler, type LeadIntakeOps } from '../../supabase/functions/lead-intake/handler';

describe('lead intake edge handler', () => {
  it('creates a canonical lead from public or staff intake', async () => {
    const calls: unknown[] = [];
    const ops: LeadIntakeOps = {
      async createLead(input) {
        calls.push(input);
        return { lead_id: 'lead-public-001' };
      },
    };
    const handler = createLeadIntakeHandler(ops);
    const response = await handler(new Request('http://local/lead-intake', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Public Bakery',
        contactName: 'Nina Cruz',
        phone: '09171234567',
        location: 'Iloilo City',
        monthlyBillEstimate: 36000,
        source: 'public_inquiry',
        goal: 'lower_bill',
        businessPropertyType: 'commercial',
        paymentPreference: 'lease_to_own',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { lead_id: 'lead-public-001' } });
    expect(calls).toHaveLength(1);
  });

  it('accepts monthly kWh when the bill amount is only a field estimate', async () => {
    const calls: Array<{ monthlyBillEstimate: number; monthlyKwh?: number }> = [];
    const handler = createLeadIntakeHandler({
      async createLead(input) {
        calls.push(input);
        return { lead_id: 'lead-kwh-001' };
      },
    });

    const response = await handler(new Request('http://local/lead-intake', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Kwh Capture',
        contactName: 'Lito Cruz',
        phone: '09170009999',
        location: 'Iloilo City',
        monthlyBillEstimate: 0,
        monthlyKwh: 1800,
        source: 'd2d',
        goal: 'lower_bill',
        businessPropertyType: 'commercial',
        paymentPreference: 'cash',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(calls[0]).toMatchObject({ monthlyBillEstimate: 19800, monthlyKwh: 1800 });
  });

  it('rejects incomplete inquiry payloads with a consistent error envelope', async () => {
    const handler = createLeadIntakeHandler({
      async createLead() {
        throw new Error('should not be called');
      },
    });
    const response = await handler(new Request('http://local/lead-intake', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('bad_request');
  });
});
