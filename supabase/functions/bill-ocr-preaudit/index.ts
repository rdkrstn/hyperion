import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { downloadPrivateObject } from '../_shared/storage.ts';
import { callGoogleVision } from '../_shared/google.ts';
import { callGeminiBillExtraction } from '../_shared/gemini.ts';
import { recalculateLeadReadiness } from '../_shared/readiness.ts';
import { logTimeline } from '../_shared/timeline.ts';
import { createBillOcrPreauditHandler } from './handler.ts';

const supabase = createSupabaseAdmin();
const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
const geminiModel = Deno.env.get('GEMINI_OCR_MODEL') || 'gemini-2.5-flash';
const googleVisionApiKey = Deno.env.get('GOOGLE_VISION_API_KEY');

async function downloadBillAsBase64(storagePath: string) {
  const file = await downloadPrivateObject(supabase, 'readiness-uploads', storagePath);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64 = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
  return {
    base64,
    mimeType: file.type || 'image/jpeg',
  };
}

Deno.serve(createBillOcrPreauditHandler({
  async extractStructuredBill({ storagePath }) {
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');
    const file = await downloadBillAsBase64(storagePath);
    return callGeminiBillExtraction({
      apiKey: geminiApiKey,
      model: geminiModel,
      base64Content: file.base64,
      mimeType: file.mimeType,
    });
  },
  async extractTextFromBill({ storagePath }) {
    if (!googleVisionApiKey) throw new Error('GOOGLE_VISION_API_KEY is not configured.');
    const file = await downloadBillAsBase64(storagePath);
    return callGoogleVision(googleVisionApiKey, file.base64);
  },
  async recordOcrResult(input) {
    const responses = await Promise.all([
      supabase.from('bill_uploads').insert({
        lead_id: input.leadId,
        ocr_provider: input.ocrProvider,
        storage_path: input.storagePath,
        file_name: input.fileName,
        status: input.needsManualReview ? 'manual_review' : 'ocr_completed',
        bill_amount: input.billAmount,
        kwh: input.kwh,
        billing_period: input.billingPeriod,
        account_name: input.accountName,
        utility_provider: input.provider,
        confidence: input.confidence,
        gemini_confidence: input.geminiConfidence,
        needs_manual_review: input.needsManualReview,
        raw_text: input.rawText,
        monthly_series: input.monthlySeries ?? [],
        annualized: input.annualized ?? false,
        source_month_count: input.sourceMonthCount ?? 0,
      }),
      supabase.from('lead_energy_profiles').upsert({
        lead_id: input.leadId,
        monthly_bill: input.billAmount ?? 0,
        monthly_kwh: input.kwh,
        billing_period: input.billingPeriod,
        utility_provider_from_bill: input.provider,
        ocr_confidence: input.confidence,
        bill_history: input.monthlySeries ?? [],
        annualized_monthly_bill: input.billAmount,
        annualized_monthly_kwh: input.kwh,
        bill_history_months: input.sourceMonthCount ?? 0,
        bill_history_annualized: input.annualized ?? false,
        updated_at: new Date().toISOString(),
      }),
    ]);
    const failed = responses.find((response) => response.error);
    if (failed?.error) throw failed.error;
    await logTimeline(supabase, {
      ownerType: 'lead',
      ownerId: input.leadId,
      leadId: input.leadId,
      title: input.needsManualReview ? 'Bill OCR needs review' : 'Bill OCR completed',
      description: input.needsManualReview ? 'OCR could not deterministically extract kWh.' : `${input.kwh} kWh extracted from bill.`,
      actorRole: 'system',
    });
  },
  recalculateReadiness: (leadId) => recalculateLeadReadiness(supabase, leadId),
}));
