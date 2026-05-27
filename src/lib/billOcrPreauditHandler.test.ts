import { describe, expect, it } from 'vitest';
import { createBillOcrPreauditHandler, type BillOcrPreauditOps } from '../../supabase/functions/bill-ocr-preaudit/handler';

describe('bill-ocr-preaudit Edge Function handler', () => {
  it('extracts bill fields and recalculates readiness only when OCR is usable', async () => {
    const calls: string[] = [];
    const ops: BillOcrPreauditOps = {
      extractTextFromBill: async () => ({ text: 'Meralco billing period May 2026 12-month average 4,250 kWh Amount due PHP 48,500', confidence: 0.88 }),
      recordOcrResult: async () => { calls.push('record'); },
      recalculateReadiness: async () => { calls.push('readiness'); },
    };
    const handler = createBillOcrPreauditHandler(ops);

    const response = await handler(new Request('http://local/bill-ocr-preaudit', {
      method: 'POST',
      body: JSON.stringify({
        lead_id: 'lead-123',
        fileName: 'bill.jpg',
        storagePath: 'lead-123/readiness/bill/bill.jpg',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.kwh).toBe(4250);
    expect(body.data.needs_manual_review).toBe(false);
    expect(calls).toEqual(['record', 'readiness']);
  });

  it('records manual review without recalculating readiness when kWh is missing', async () => {
    const calls: string[] = [];
    const ops: BillOcrPreauditOps = {
      extractTextFromBill: async () => ({ text: 'Meralco Amount due PHP 48,500', confidence: 0.93 }),
      recordOcrResult: async () => { calls.push('record'); },
      recalculateReadiness: async () => { calls.push('readiness'); },
    };
    const handler = createBillOcrPreauditHandler(ops);

    const response = await handler(new Request('http://local/bill-ocr-preaudit', {
      method: 'POST',
      body: JSON.stringify({
        lead_id: 'lead-123',
        fileName: 'bill.jpg',
        storagePath: 'lead-123/readiness/bill/bill.jpg',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.data.needs_manual_review).toBe(true);
    expect(calls).toEqual(['record']);
  });

  it('uses structured Gemini bill extraction and annualizes short bill history', async () => {
    const recorded: unknown[] = [];
    const ops: BillOcrPreauditOps = {
      extractStructuredBill: async () => ({
        provider: 'Meralco',
        accountName: 'Sample Store',
        confidence: 0.91,
        months: [
          { periodLabel: '2026-01', billAmount: 9000, kwh: 700 },
          { periodLabel: '2026-02', billAmount: 12000, kwh: 1000 },
          { periodLabel: '2026-03', billAmount: 15000, kwh: 1300 },
        ],
      }),
      extractTextFromBill: async () => {
        throw new Error('Vision fallback should not be used');
      },
      recordOcrResult: async (input) => { recorded.push(input); },
      recalculateReadiness: async () => undefined,
    };
    const handler = createBillOcrPreauditHandler(ops);

    const response = await handler(new Request('http://local/bill-ocr-preaudit', {
      method: 'POST',
      body: JSON.stringify({
        lead_id: 'lead-123',
        fileName: 'bill.jpg',
        storagePath: 'lead-123/readiness/bill/bill.jpg',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.ocr_provider).toBe('gemini');
    expect(body.data.annualized).toBe(true);
    expect(body.data.source_month_count).toBe(3);
    expect(body.data.monthly_series).toHaveLength(12);
    expect(body.data.bill_amount).toBe(12000);
    expect(body.data.kwh).toBe(1000);
    expect(recorded[0]).toMatchObject({
      ocrProvider: 'gemini',
      annualized: true,
      sourceMonthCount: 3,
      accountName: 'Sample Store',
    });
  });

  it('falls back to Google Vision text extraction when Gemini structured extraction fails', async () => {
    const calls: string[] = [];
    const ops: BillOcrPreauditOps = {
      extractStructuredBill: async () => {
        calls.push('gemini');
        throw new Error('Gemini unavailable');
      },
      extractTextFromBill: async () => {
        calls.push('vision');
        return { text: 'Meralco billing period May 2026 12-month average 4,250 kWh Amount due PHP 48,500', confidence: 0.88 };
      },
      recordOcrResult: async () => { calls.push('record'); },
      recalculateReadiness: async () => { calls.push('readiness'); },
    };
    const handler = createBillOcrPreauditHandler(ops);

    const response = await handler(new Request('http://local/bill-ocr-preaudit', {
      method: 'POST',
      body: JSON.stringify({
        lead_id: 'lead-123',
        fileName: 'bill.jpg',
        storagePath: 'lead-123/readiness/bill/bill.jpg',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.ocr_provider).toBe('google_vision');
    expect(body.data.kwh).toBe(4250);
    expect(calls).toEqual(['gemini', 'vision', 'record', 'readiness']);
  });
});
