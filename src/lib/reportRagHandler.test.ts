import { describe, expect, it } from 'vitest';
import { createReportRagHandler, type ReportRagOps } from '../../supabase/functions/report-rag/handler';

describe('report RAG edge handler', () => {
  it('creates summary, embedding, and snapshot for owner or manager', async () => {
    const calls: string[] = [];
    const ops: ReportRagOps = {
      async authorizeReportReviewer() {
        calls.push('auth');
        return { allowed: true, role: 'manager' };
      },
      async summarizeReport() {
        calls.push('summary');
        return 'Revenue operations summary: qualified leads and billing health are improving.';
      },
      async createEmbedding() {
        calls.push('embedding');
        return new Array(1536).fill(0.02);
      },
      async storeSnapshot() {
        calls.push('snapshot');
        return { id: 'report-001' };
      },
    };
    const handler = createReportRagHandler(ops);
    const response = await handler(new Request('http://local/report-rag', {
      method: 'POST',
      headers: { authorization: 'Bearer test' },
      body: JSON.stringify({ title: 'Weekly owner report', metrics: { leads: 10 } }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reportId).toBe('report-001');
    expect(calls).toEqual(['auth', 'summary', 'embedding', 'snapshot']);
  });

  it('blocks non-owner and non-manager report generation', async () => {
    const handler = createReportRagHandler({
      async authorizeReportReviewer() {
        return { allowed: false, role: 'sales' };
      },
      async summarizeReport() {
        throw new Error('should not summarize');
      },
      async createEmbedding() {
        throw new Error('should not embed');
      },
      async storeSnapshot() {
        throw new Error('should not store');
      },
    });
    const response = await handler(new Request('http://local/report-rag', {
      method: 'POST',
      headers: { authorization: 'Bearer test' },
      body: JSON.stringify({ title: 'Blocked', metrics: {} }),
    }));

    expect(response.status).toBe(403);
  });
});
