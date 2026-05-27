import type {
  ComplianceDocument,
  ComplianceDocumentType,
  ComplianceRule,
  ComplianceSlaStatus,
  Deal,
  NetMeteringWorkflow,
  Role,
} from '../types';

export const requiredComplianceDocumentTypes: ComplianceDocumentType[] = [
  'net_metering_application',
  'certificate_of_completion',
];

export const defaultComplianceRule: ComplianceRule = {
  id: 'ph-net-metering-ra11032-v1',
  version: 'PH-NM-RA11032-2026-05',
  title: 'Philippine net-metering compliance and RA 11032 deemed-approval tracker',
  sourceNotes: [
    'DOE Net Metering Guide: https://legacy.doe.gov.ph/net-metering/net-metering-guide',
    'DOE Net Metering Reference Guide: https://legacy.doe.gov.ph/sites/default/files/pdf/netmeter/net-metering-reference-guide-philippines-E.pdf',
    'DPWH RA 11032 circular: https://www.dpwh.gov.ph/dpwh/issuances/department-memorandum-circulars/13992',
    'RA 11032 IRR: https://elibrary.judiciary.gov.ph//thebookshelf//showdocs/2/96391',
  ],
  electricalPermitWorkingDays: 3,
  cfeiWorkingDays: 7,
  effectiveAt: '2026-05-20',
};

function dateOnly(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function localIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function countWorkingDaysSince(startAt?: string, now: string | Date = new Date(), holidays: string[] = []) {
  if (!startAt) return 0;
  const start = dateOnly(startAt);
  const end = dateOnly(now);
  const holidaySet = new Set(holidays);
  let days = 0;
  for (let current = new Date(start); current < end; current.setDate(current.getDate() + 1)) {
    const day = current.getDay();
    const iso = localIsoDate(current);
    if (day !== 0 && day !== 6 && !holidaySet.has(iso)) days += 1;
  }
  return days;
}

export function complianceSlaStatus(input: {
  submittedAt?: string;
  actualReceivedAt?: string;
  thresholdWorkingDays: number;
  holidays?: string[];
  now?: Date;
}): { status: ComplianceSlaStatus; workingDays: number; badge: string; relievesBlocker: boolean } {
  if (!input.submittedAt) {
    return { status: 'not_submitted', workingDays: 0, badge: 'Not submitted', relievesBlocker: false };
  }
  if (input.actualReceivedAt) {
    return {
      status: 'actual_document_received',
      workingDays: countWorkingDaysSince(input.submittedAt, input.actualReceivedAt, input.holidays),
      badge: 'Actual document received',
      relievesBlocker: true,
    };
  }
  const workingDays = countWorkingDaysSince(input.submittedAt, input.now, input.holidays);
  if (workingDays >= input.thresholdWorkingDays) {
    return {
      status: 'deemed_approved',
      workingDays,
      badge: 'DEEMED APPROVED (RA 11032)',
      relievesBlocker: true,
    };
  }
  return { status: 'in_progress', workingDays, badge: `${workingDays}/${input.thresholdWorkingDays} working days`, relievesBlocker: false };
}

export function hasRequiredComplianceDocuments(documents: ComplianceDocument[] = []) {
  const generated = new Set(documents.map((document) => document.documentType));
  const missing = requiredComplianceDocumentTypes.filter((documentType) => !generated.has(documentType));
  return { allowed: missing.length === 0, missing };
}

export function evaluateSolarApiGate(deal: Deal) {
  const insights = deal.solarInsights;
  if (insights?.ownerOverrideAt) {
    return { allowed: true, reason: `Owner override: ${insights.ownerOverrideReason ?? 'Solar API manual review accepted.'}` };
  }
  if (!insights || insights.status === 'maps_pending') {
    return { allowed: false, reason: 'Google Solar API roof mapping is pending.' };
  }
  if (insights.status !== 'ready') {
    return { allowed: false, reason: 'Google Solar API roof mapping failed and needs owner override.' };
  }
  if (insights.imageryQuality === 'BASE' || !insights.maxSystemSizeKwp) {
    return { allowed: false, reason: 'Google Solar API quality or roof capacity is too weak for formal quote.' };
  }
  return { allowed: true, reason: `${insights.maxSystemSizeKwp} kWp roof capacity verified by Solar API.` };
}

export function evaluateComplianceGate(deal: Deal) {
  const documentsGate = hasRequiredComplianceDocuments(deal.complianceDocuments);
  const workflow = deal.netMeteringWorkflow;
  const ready = Boolean(workflow?.readyForLenderAt || workflow?.ownerReadyOverrideAt || workflow?.status === 'ready_for_lender');
  const missing = [
    ...documentsGate.missing.map((documentType) => documentType.replaceAll('_', ' ')),
    ready ? '' : 'Net-metering workflow ready for lender',
  ].filter(Boolean);
  return {
    allowed: documentsGate.allowed && ready,
    reason: documentsGate.allowed && ready
      ? 'Compliance PDFs are generated and net-metering is ready for lender review.'
      : `Compliance blocker: ${missing.join(', ')}.`,
    missing,
  };
}

export function createComplianceDocuments(input: {
  deal: Deal;
  actorRole: Role;
  signerName: string;
  templateVersion?: string;
  rule?: ComplianceRule;
}) {
  if (input.actorRole !== 'cs' && input.actorRole !== 'owner') {
    throw new Error('Only CS or owner can generate compliance documents.');
  }
  if (!input.signerName.trim()) throw new Error('Signer metadata is required before compliance document generation.');
  const rule = input.rule ?? input.deal.complianceRule ?? defaultComplianceRule;
  const now = new Date().toLocaleString('en-PH');
  return requiredComplianceDocumentTypes.map((documentType) => ({
    id: `compliance-${documentType}-${input.deal.id}`,
    leadId: input.deal.id,
    documentType,
    templateVersion: input.templateVersion ?? rule.version,
    storagePath: `${input.deal.id}/compliance/${documentType}-${rule.version}.pdf`,
    sha256: `local-${documentType}-${input.deal.id}-${rule.version}`,
    generatedByRole: input.actorRole,
    signerName: input.signerName.trim(),
    ruleVersion: rule.version,
    createdAt: now,
  }));
}

export function markWorkflowReadyForLender(workflow: NetMeteringWorkflow, actorRole: Role, reason?: string): NetMeteringWorkflow {
  if (actorRole !== 'owner') throw new Error('Only owner can mark net-metering ready for lender.');
  const now = new Date().toLocaleString('en-PH');
  return {
    ...workflow,
    status: 'ready_for_lender',
    readyForLenderAt: now,
    ownerReadyOverrideAt: reason ? now : workflow.ownerReadyOverrideAt,
    ownerReadyOverrideReason: reason || workflow.ownerReadyOverrideReason,
  };
}
