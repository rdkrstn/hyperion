import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export type EdgeFunctionName =
  | 'lead-intake'
  | 'bill-ocr-preaudit'
  | 'maps-enrichment'
  | 'solar-snapshot'
  | 'readiness-score'
  | 'remote-intake-create'
  | 'remote-intake-access'
  | 'remote-intake-upload'
  | 'document-signed-url'
  | 'document-validate'
  | 'survey-dispatch'
  | 'survey-evidence-upload'
  | 'generate-proposal'
  | 'generate-compliance-docs'
  | 'contract-access';

export type EdgeSuccess<T> = { ok: true; data: T };
export type EdgeFailure = { ok: false; error: { code: string; message: string; details?: unknown } };
export type EdgeResult<T> = EdgeSuccess<T> | EdgeFailure;

export type EdgeInvokeOptions = {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | boolean | undefined>;
};

export function edgeFunctionUrl(name: EdgeFunctionName, query?: EdgeInvokeOptions['query']) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl) return undefined;
  const url = new URL(`/functions/v1/${name}`, supabaseUrl);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function callEdgeFunction<TData, TPayload = unknown>(
  name: EdgeFunctionName,
  payload?: TPayload,
  options: EdgeInvokeOptions = {},
): Promise<EdgeResult<TData>> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      error: {
        code: 'supabase_not_configured',
        message: 'Supabase is required for production business mutations. Local workspace mode uses in-memory fallback actions.',
      },
    };
  }

  if (options.method === 'GET') {
    const url = edgeFunctionUrl(name, options.query);
    if (!url) {
      return { ok: false, error: { code: 'supabase_not_configured', message: 'Supabase URL is not configured.' } };
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch(url, {
      headers: sessionData.session?.access_token ? { authorization: `Bearer ${sessionData.session.access_token}` } : undefined,
    });
    const body = await response.json();
    return normalizeEdgeEnvelope<TData>(body, response.status);
  }

  const { data, error } = await supabase.functions.invoke(name, { body: payload as Record<string, unknown> | undefined });
  if (error) {
    return {
      ok: false,
      error: {
        code: 'edge_function_error',
        message: error.message,
        details: error,
      },
    };
  }
  return normalizeEdgeEnvelope<TData>(data, 200);
}

function normalizeEdgeEnvelope<TData>(body: unknown, status: number): EdgeResult<TData> {
  const envelope = body as { ok?: boolean; data?: TData; error?: EdgeFailure['error'] };
  if (envelope?.ok === true) return envelope as EdgeSuccess<TData>;
  if (envelope?.ok === false && envelope.error) return envelope as EdgeFailure;
  if (status >= 400) {
    return {
      ok: false,
      error: {
        code: 'edge_function_error',
        message: typeof body === 'object' && body && 'error' in body ? String((body as { error: unknown }).error) : 'Edge Function request failed.',
        details: body,
      },
    };
  }
  return { ok: true, data: body as TData };
}
