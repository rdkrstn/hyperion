import { handleCors } from '../_shared/cors.ts';
import { ApiError, jsonError, jsonOk, readJson, requireString } from '../_shared/errors.ts';
import { extractBillFields } from '../_shared/google.ts';
import type { GeminiBillExtraction, GeminiBillMonth } from '../_shared/gemini.ts';

export interface BillSeriesMonth {
  periodLabel: string;
  billAmount: number;
  kwh?: number;
  source: 'observed' | 'annualized';
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function annualizeMonths(months: GeminiBillMonth[]) {
  const observed: BillSeriesMonth[] = months
    .filter((month) => Number.isFinite(month.billAmount) && month.billAmount > 0)
    .slice(0, 12)
    .map((month) => ({
      periodLabel: month.periodLabel,
      billAmount: Math.round(month.billAmount),
      kwh: Number.isFinite(month.kwh) ? Math.round(month.kwh!) : undefined,
      source: 'observed',
    }));
  const sourceMonthCount = observed.length;
  const averageBill = average(observed.map((month) => month.billAmount));
  const kwhValues = observed.map((month) => month.kwh).filter((value): value is number => Number.isFinite(value));
  const averageKwh = kwhValues.length ? average(kwhValues) : undefined;
  const series = [...observed];

  while (sourceMonthCount > 0 && series.length < 12) {
    series.push({
      periodLabel: `Annualized ${series.length + 1}`,
      billAmount: averageBill,
      kwh: averageKwh,
      source: 'annualized',
    });
  }

  return {
    monthlySeries: series,
    sourceMonthCount,
    annualized: sourceMonthCount > 0 && sourceMonthCount < 12,
    averageBillAmount: average(series.map((month) => month.billAmount)),
    averageKwh: average(series.map((month) => month.kwh).filter((value): value is number => Number.isFinite(value))),
  };
}

export type BillOcrPreauditOps = {
  extractStructuredBill?: (input: { leadId: string; storagePath: string }) => Promise<GeminiBillExtraction>;
  extractTextFromBill: (input: { leadId: string; storagePath: string }) => Promise<{ text: string; confidence?: number }>;
  recordOcrResult: (input: {
    leadId: string;
    storagePath: string;
    fileName: string;
    ocrProvider: 'gemini' | 'google_vision';
    billAmount?: number;
    kwh?: number;
    billingPeriod?: string;
    provider?: string;
    accountName?: string;
    confidence: number;
    geminiConfidence?: number;
    needsManualReview: boolean;
    rawText: string;
    monthlySeries?: BillSeriesMonth[];
    annualized?: boolean;
    sourceMonthCount?: number;
  }) => Promise<unknown>;
  recalculateReadiness: (leadId: string) => Promise<unknown>;
};

export function createBillOcrPreauditHandler(ops: BillOcrPreauditOps) {
  return async function handleBillOcrPreaudit(request: Request) {
    const cors = handleCors(request);
    if (cors) return cors;
    if (request.method !== 'POST') return jsonError(new ApiError('method_not_allowed', 'Method not allowed.', 405));

    try {
      const input = await readJson<{ lead_id?: string; leadId?: string; storagePath?: string; fileName?: string }>(request);
      const leadId = requireString(input.lead_id ?? input.leadId, 'lead_id');
      const storagePath = requireString(input.storagePath, 'storagePath');
      const fileName = requireString(input.fileName ?? storagePath.split('/').at(-1), 'fileName');
      if (ops.extractStructuredBill) {
        try {
          const structured = await ops.extractStructuredBill({ leadId, storagePath });
          const annualized = annualizeMonths(structured.months);
          const needsManualReview = !annualized.sourceMonthCount || structured.confidence < 0.65;
          const result = {
            bill_amount: annualized.averageBillAmount || undefined,
            kwh: annualized.averageKwh || undefined,
            billing_period: structured.months[0]?.periodLabel,
            provider: structured.provider,
            account_name: structured.accountName,
            confidence: structured.confidence,
            gemini_confidence: structured.confidence,
            needs_manual_review: needsManualReview,
            ocr_provider: 'gemini' as const,
            monthly_series: annualized.monthlySeries,
            annualized: annualized.annualized,
            source_month_count: annualized.sourceMonthCount,
          };
          await ops.recordOcrResult({
            leadId,
            storagePath,
            fileName,
            ocrProvider: 'gemini',
            billAmount: result.bill_amount,
            kwh: result.kwh,
            billingPeriod: result.billing_period,
            provider: result.provider,
            accountName: result.account_name,
            confidence: result.confidence,
            geminiConfidence: result.gemini_confidence,
            needsManualReview,
            rawText: JSON.stringify(structured),
            monthlySeries: result.monthly_series,
            annualized: result.annualized,
            sourceMonthCount: result.source_month_count,
          });
          if (!needsManualReview) await ops.recalculateReadiness(leadId);
          return jsonOk(result, needsManualReview ? 202 : 200);
        } catch (_error) {
          // Fall back to deterministic Vision OCR below. The fallback result records the actual provider used.
        }
      }
      const extraction = await ops.extractTextFromBill({ leadId, storagePath });
      const fields = extractBillFields(extraction.text, extraction.confidence ?? 0);
      await ops.recordOcrResult({
        leadId,
        storagePath,
        fileName,
        ocrProvider: 'google_vision',
        billAmount: fields.bill_amount,
        kwh: fields.kwh,
        billingPeriod: fields.billing_period,
        provider: fields.provider,
        confidence: fields.confidence,
        needsManualReview: fields.needs_manual_review,
        rawText: extraction.text,
        monthlySeries: fields.bill_amount || fields.kwh ? [{
          periodLabel: fields.billing_period ?? 'Observed bill',
          billAmount: fields.bill_amount ?? 0,
          kwh: fields.kwh,
          source: 'observed',
        }] : [],
        annualized: false,
        sourceMonthCount: fields.bill_amount || fields.kwh ? 1 : 0,
      });
      if (!fields.needs_manual_review) await ops.recalculateReadiness(leadId);
      return jsonOk({ ...fields, ocr_provider: 'google_vision' }, fields.needs_manual_review ? 202 : 200);
    } catch (error) {
      return jsonError(error);
    }
  };
}
