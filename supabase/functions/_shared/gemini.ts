import { ApiError } from './errors.ts';

export interface GeminiBillMonth {
  periodLabel: string;
  billAmount: number;
  kwh?: number;
}

export interface GeminiBillExtraction {
  provider?: string;
  accountName?: string;
  confidence: number;
  months: GeminiBillMonth[];
  notes?: string[];
}

const billSchema = {
  type: 'object',
  properties: {
    provider: { type: ['string', 'null'], description: 'Electric utility provider name, for example Meralco.' },
    accountName: { type: ['string', 'null'], description: 'Customer or account name printed on the bill.' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    months: {
      type: 'array',
      minItems: 1,
      maxItems: 12,
      items: {
        type: 'object',
        properties: {
          periodLabel: { type: 'string', description: 'Billing month or period label.' },
          billAmount: { type: 'number', description: 'Bill amount in Philippine pesos.' },
          kwh: { type: ['number', 'null'], description: 'Energy consumption in kWh when visible.' },
        },
        required: ['periodLabel', 'billAmount'],
      },
    },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['confidence', 'months'],
};

function parseGeminiText(body: any) {
  const parts = body?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => part.text ?? '').join('').trim();
}

export function normalizeGeminiBillExtraction(raw: unknown): GeminiBillExtraction {
  const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const months = Array.isArray(record.months)
    ? record.months.map((month) => {
      const item = month && typeof month === 'object' ? month as Record<string, unknown> : {};
      return {
        periodLabel: String(item.periodLabel ?? item.period ?? 'Observed bill'),
        billAmount: Number(item.billAmount ?? item.amount ?? 0),
        kwh: item.kwh === null || item.kwh === undefined ? undefined : Number(item.kwh),
      };
    }).filter((month) => Number.isFinite(month.billAmount) && month.billAmount > 0)
    : [];

  return {
    provider: typeof record.provider === 'string' ? record.provider : undefined,
    accountName: typeof record.accountName === 'string' ? record.accountName : undefined,
    confidence: Number(record.confidence ?? 0),
    months,
    notes: Array.isArray(record.notes) ? record.notes.map(String) : undefined,
  };
}

export async function callGeminiBillExtraction(input: {
  apiKey: string;
  model?: string;
  base64Content: string;
  mimeType: string;
}): Promise<GeminiBillExtraction> {
  const model = input.model || 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': input.apiKey,
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          {
            text: 'Extract the electricity bill history from this Philippine utility bill. Return only structured JSON. Prefer 12 months when printed. If only 3 to 6 months are visible, return those observed months exactly.',
          },
          {
            inlineData: {
              mimeType: input.mimeType,
              data: input.base64Content,
            },
          },
        ],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: billSchema,
      },
    }),
  });
  if (!response.ok) throw new ApiError('upstream_unavailable', `Gemini bill OCR failed with ${response.status}.`, 502);
  const body = await response.json();
  const text = parseGeminiText(body);
  if (!text) throw new ApiError('upstream_unavailable', 'Gemini did not return bill extraction JSON.', 502);
  try {
    return normalizeGeminiBillExtraction(JSON.parse(text));
  } catch (_error) {
    throw new ApiError('upstream_unavailable', 'Gemini bill extraction JSON could not be parsed.', 502);
  }
}
