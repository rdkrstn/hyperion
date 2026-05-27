import type {
  AutomationEvent,
  AutomationEventType,
  BillOcrProvider,
  BillOcrResult,
  FinancingPacket,
  LeadStage,
  PreAuditRun,
  PreAuditSnapshot,
  ReadinessIntake,
  ReadinessResult,
} from '../types';

function stamp() {
  return new Date().toLocaleString('en-PH');
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function parseAmount(text: string) {
  const amountMatch = text.match(/(?:amount due|total amount due|php|₱)\s*(?:php|₱)?\s*([\d,]+(?:\.\d+)?)/i);
  return amountMatch ? Math.round(Number(amountMatch[1].replaceAll(',', ''))) : 0;
}

function parseKwh(text: string) {
  const averageMatch = text.match(/(?:average consumption|average monthly|12[-\s]?month average|avg\.?)\D{0,24}([\d,]+(?:\.\d+)?)\s*kwh/i);
  const genericMatch = text.match(/([\d,]+(?:\.\d+)?)\s*kwh/i);
  const match = averageMatch ?? genericMatch;
  return match ? Math.round(Number(match[1].replaceAll(',', ''))) : 0;
}

function parseUtility(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes('meralco')) return 'Meralco';
  if (lower.includes('more power')) return 'MORE Power';
  if (lower.includes('vec0') || lower.includes('veco')) return 'VECO';
  if (lower.includes('dlpc')) return 'DLPC';
  return '';
}

export function normalizeBillOcrResult(input: {
  text: string;
  confidence?: number;
  provider?: BillOcrProvider;
}): BillOcrResult {
  const averageMonthlyKwh = parseKwh(input.text);
  const monthlyBillAmount = parseAmount(input.text);
  const utilityProvider = parseUtility(input.text);
  const extractionConfidence = Number((input.confidence ?? 0).toFixed(2));
  const riskFlags = [
    !averageMonthlyKwh ? 'Average monthly kWh was not confidently extracted.' : '',
    !monthlyBillAmount ? 'Monthly bill amount was not confidently extracted.' : '',
    !utilityProvider ? 'Utility provider was not detected.' : '',
    extractionConfidence < 0.7 ? 'OCR confidence is below review threshold.' : '',
  ].filter(Boolean);
  const blocksPreAudit = !averageMonthlyKwh || extractionConfidence < 0.7;

  return {
    provider: input.provider ?? 'google_vision',
    rawText: input.text,
    averageMonthlyKwh,
    monthlyBillAmount,
    utilityProvider,
    extractionConfidence,
    manualReviewRequired: blocksPreAudit,
    riskFlags,
  };
}

function buildAutomationEvent(eventType: AutomationEventType, linkedRecordId: string, payload: AutomationEvent['payload'] = {}): AutomationEvent {
  return {
    id: id('automation'),
    eventType,
    linkedRecordType: eventType.includes('packet') ? 'financing' : 'lead',
    linkedRecordId,
    payload,
    status: 'ready_for_external_sync',
    createdAt: stamp(),
  };
}

export function buildPreAuditFromReadiness(input: ReadinessIntake, readiness: ReadinessResult): PreAuditSnapshot {
  const monthlyKwh = Math.round(input.monthlyElectricityBill / 11);
  const sizeKwp = readiness.recommendedSystemSizeKwp;
  const monthlyProduction = Math.round(sizeKwp * 110);
  const capex = Math.round(sizeKwp * 55000);
  const projectedSavings = readiness.monthlySavingsHigh;

  return {
    monthlyKwh,
    targetOffset: 0.65,
    sizeKwp,
    monthlyProduction,
    projectedSavings,
    capex,
    paybackYears: readiness.paybackYearsLow,
    rtoDownpayment: Math.round(capex * 0.15),
    rtoMonthly: Math.round((capex * 0.9) / 36),
    bankDownpayment: Math.round(capex * 0.2),
    bankMonthly: Math.round((capex * 0.8) / 48),
  };
}

export function runFieldPreAudit(input: {
  leadId?: string;
  intake: ReadinessIntake;
  readiness: ReadinessResult;
  financingPacket: FinancingPacket;
  ocrResult?: BillOcrResult;
}): PreAuditRun {
  const leadId = input.leadId ?? 'pending-lead';
  const ocrBlocksPreAudit = !input.ocrResult || input.ocrResult.manualReviewRequired;
  const nextStage: LeadStage = !ocrBlocksPreAudit && input.readiness.readinessScore > 70 ? 'pre_audit_done' : 'captured';
  const eventPayload = {
    readinessScore: input.readiness.readinessScore,
    systemSizeKwp: input.readiness.recommendedSystemSizeKwp,
    packetStatus: input.financingPacket.status,
  };

  return {
    id: id('preaudit-run'),
    leadId,
    readinessScore: input.readiness.readinessScore,
    nextStage,
    preAudit: buildPreAuditFromReadiness(input.intake, input.readiness),
    financingPacketStatus: input.financingPacket.status,
    automationEvents: [
      buildAutomationEvent('lead_captured', leadId, { source: 'd2d_field_capture' }),
      buildAutomationEvent('bill_uploaded', leadId, { fileName: input.intake.billUploadFileName ?? null }),
      buildAutomationEvent('ocr_completed', leadId, { confidence: input.ocrResult?.extractionConfidence ?? null }),
      buildAutomationEvent('pre_audit_completed', leadId, eventPayload),
      buildAutomationEvent('packet_drafted', leadId, eventPayload),
    ],
    createdAt: stamp(),
  };
}
