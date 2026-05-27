import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';
import { createReportRagHandler } from './handler.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;
const openAiKey = Deno.env.get('OPENAI_API_KEY');

if (!supabaseUrl || !serviceRoleKey || !openAiKey) {
  throw new Error('SUPABASE_URL, server-side Supabase secret key, and OPENAI_API_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(createReportRagHandler({
  async authorizeReportReviewer(authorization) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return { allowed: false };
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return { allowed: false };
    const { data: profile, error: profileError } = await supabase
      .from('staff_profiles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('active', true)
      .single();
    if (profileError) return { allowed: false };
    return { allowed: profile.role === 'owner' || profile.role === 'manager', role: profile.role };
  },

  async summarizeReport({ title, metrics }) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: `Summarize this solar revenue operations report for an owner or manager. Title: ${title}. Metrics: ${JSON.stringify(metrics)}.`,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI summary failed: ${response.status}`);
    const body = await response.json();
    return body.output_text ?? 'Revenue operations summary generated.';
  },

  async createEmbedding(content) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: content,
        encoding_format: 'float',
      }),
    });
    if (!response.ok) throw new Error(`OpenAI embedding failed: ${response.status}`);
    const body = await response.json();
    return body.data[0].embedding;
  },

  async storeSnapshot({ title, summary, metrics, embedding, role }) {
    const { data: report, error: reportError } = await supabase
      .from('analytics_report_snapshots')
      .insert({
        title,
        summary,
        metrics,
        created_by_role: role,
        status: 'embedded',
      })
      .select('id')
      .single();
    if (reportError) throw reportError;

    const { error: chunkError } = await supabase.from('report_embedding_chunks').insert({
      report_id: report.id,
      content: `${title}\n${summary}\n${JSON.stringify(metrics)}`,
      embedding,
      model: 'text-embedding-3-small',
    });
    if (chunkError) throw chunkError;
    return report;
  },
}));
