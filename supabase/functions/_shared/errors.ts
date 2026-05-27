import { corsHeaders } from './cors.ts';

export type ApiErrorCode =
  | 'bad_request'
  | 'forbidden'
  | 'not_found'
  | 'method_not_allowed'
  | 'manual_review'
  | 'upstream_unavailable'
  | 'internal_error';

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ApiErrorCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function jsonOk<T>(data: T, status = 200) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function jsonError(error: unknown) {
  const apiError = error instanceof ApiError
    ? error
    : new ApiError('internal_error', error instanceof Error ? error.message : 'Unknown function error.', 500);
  return new Response(JSON.stringify({
    ok: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      details: apiError.details,
    },
  }), {
    status: apiError.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new ApiError('bad_request', 'Request body must be valid JSON.');
  }
}

export function requireString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError('bad_request', `${field} is required.`);
  }
  return value.trim();
}

export function requireNumber(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new ApiError('bad_request', `${field} must be a valid number.`);
  return number;
}
