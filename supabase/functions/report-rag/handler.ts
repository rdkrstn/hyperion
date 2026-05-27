export type ReportReviewerRole = 'owner' | 'manager' | 'sales' | 'cs' | 'installer';

export type ReportRagOps = {
  authorizeReportReviewer: (authorization: string | null) => Promise<{ allowed: boolean; role?: ReportReviewerRole }>;
  summarizeReport: (input: { title: string; metrics: Record<string, unknown> }) => Promise<string>;
  createEmbedding: (content: string) => Promise<number[]>;
  storeSnapshot: (input: {
    title: string;
    summary: string;
    metrics: Record<string, unknown>;
    embedding: number[];
    role?: ReportReviewerRole;
  }) => Promise<{ id: string }>;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function createReportRagHandler(ops: ReportRagOps) {
  return async function handleReportRag(request: Request) {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

    try {
      const auth = await ops.authorizeReportReviewer(request.headers.get('authorization'));
      if (!auth.allowed) return json({ error: 'Only owner or manager can generate report summaries.' }, 403);

      const body = await request.json() as { title?: string; metrics?: Record<string, unknown> };
      const title = body.title?.trim();
      if (!title) return json({ error: 'Report title is required.' }, 400);
      const metrics = body.metrics ?? {};
      const summary = await ops.summarizeReport({ title, metrics });
      const embedding = await ops.createEmbedding(`${title}\n${summary}\n${JSON.stringify(metrics)}`);
      if (embedding.length !== 1536) return json({ error: 'Embedding must be 1536 dimensions for text-embedding-3-small.' }, 500);
      const snapshot = await ops.storeSnapshot({ title, summary, metrics, embedding, role: auth.role });
      return json({ reportId: snapshot.id, summary });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Unknown report RAG error.' }, 500);
    }
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
