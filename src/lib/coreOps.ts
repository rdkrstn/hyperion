import type {
  AnalyticsReportSnapshot,
  BillingLedgerEvent,
  BillingLedgerEventType,
  CalendarEvent,
  CalendarEventType,
  Deal,
  LeadInput,
  LinkedRecordType,
  QualificationAnswerMap,
  QualificationRecord,
  QualificationSection,
  QualificationSectionId,
  Role,
  SurveyEvidenceRequirement,
  SurveyUpload,
  SurveyUploadCategory,
  TicketCategory,
  TicketPriority,
  TicketRecord,
} from '../types';

export const qualificationSections: QualificationSection[] = [
  { id: 'inquiry', label: 'Inquiry', required: true },
  { id: 'business_fit', label: 'Business fit', required: true },
  { id: 'bill_energy', label: 'Bill / energy', required: true },
  { id: 'site_control', label: 'Site control', required: true },
  { id: 'financing_fit', label: 'Financing fit', required: true },
  { id: 'decision_timeline', label: 'Decision / timeline', required: true },
  { id: 'docs', label: 'Documents', required: true },
  { id: 'notes', label: 'Notes', required: false },
];

export const requiredSurveyUploadCategories: SurveyUploadCategory[] = [
  'main_breaker_panel',
  'roof_surface',
  'inverter_location',
  'wire_run_path',
];

export const surveyEvidenceRequirements: SurveyEvidenceRequirement[] = [
  { category: 'main_breaker_panel', label: 'Main Breaker Panel', required: true },
  { category: 'roof_surface', label: 'Roof Surface', required: true },
  { category: 'inverter_location', label: 'Inverter Location', required: true },
  { category: 'wire_run_path', label: 'Wire Run Path', required: true },
];

function stamp() {
  return new Date().toLocaleString('en-PH');
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function defaultQualification(input: LeadInput): QualificationRecord {
  return scoreQualification(input, {
    inquiry: true,
    business_fit: false,
    bill_energy: false,
    site_control: false,
    financing_fit: false,
    decision_timeline: false,
    docs: false,
    notes: Boolean(input.staffNotes),
  });
}

export function scoreQualification(input: LeadInput, answers: QualificationAnswerMap, overrideNote = ''): QualificationRecord {
  const normalizedAnswers = {
    ...answers,
    inquiry: answers.inquiry ?? Boolean(input.businessName && input.contactName && input.location && input.averageMonthlyBill > 0),
  };
  const required = qualificationSections.filter((section) => section.required);
  const missingSections = required.filter((section) => !normalizedAnswers[section.id]).map((section) => section.id);
  const completeCount = required.length - missingSections.length;
  const billScore = input.averageMonthlyBill >= 25000 ? 15 : 5;
  const readinessScore = input.interestLevel === 'Ready for site survey' ? 15 : input.interestLevel === 'Wants quote first' ? 10 : 5;
  const score = Math.min(100, Math.round((completeCount / required.length) * 70 + billScore + readinessScore));
  const status = resolveQualificationStatus(input, missingSections, score, overrideNote);

  return {
    status,
    score,
    missingSections: overrideNote ? [] : missingSections,
    overrideNote: overrideNote || undefined,
    updatedAt: stamp(),
  };
}

function resolveQualificationStatus(input: LeadInput, missingSections: QualificationSectionId[], score: number, overrideNote: string): QualificationRecord['status'] {
  if (input.propertyControl === 'Rents / no authorization yet') return overrideNote ? 'qualified' : 'disqualified';
  if (overrideNote) return 'qualified';
  if (missingSections.length > 0) return missingSections.length >= 5 ? 'new_inquiry' : 'qualifying';
  if (score >= 70) return 'qualified';
  return 'nurture';
}

export function buildTicket(input: {
  linkedRecordType: LinkedRecordType;
  linkedRecordId: string;
  category: TicketCategory;
  priority: TicketPriority;
  title: string;
  ownerRole: Role;
  assigneeName?: string;
  dueAt?: string;
}): TicketRecord {
  return {
    id: id('ticket'),
    linkedRecordType: input.linkedRecordType,
    linkedRecordId: input.linkedRecordId,
    category: input.category,
    priority: input.priority,
    status: 'open',
    title: input.title,
    ownerRole: input.ownerRole,
    assigneeName: input.assigneeName ?? 'Unassigned',
    dueAt: input.dueAt ?? 'Next business day',
    comments: [{ id: id('comment'), body: 'Ticket created for internal operations follow-up.', authorRole: input.ownerRole, createdAt: stamp() }],
    createdAt: stamp(),
  };
}

export function buildCalendarEvent(input: {
  title: string;
  linkedRecordType: LinkedRecordType;
  linkedRecordId: string;
  startAt: string;
  endAt: string;
  ownerRole: Role;
  type?: CalendarEventType;
  location?: string;
  notes?: string;
}): CalendarEvent {
  return {
    id: id('event'),
    type: input.type ?? (input.linkedRecordType === 'survey' ? 'survey' : 'follow_up'),
    title: input.title,
    linkedRecordType: input.linkedRecordType,
    linkedRecordId: input.linkedRecordId,
    startAt: input.startAt,
    endAt: input.endAt,
    ownerRole: input.ownerRole,
    location: input.location,
    notes: input.notes,
  };
}

export function buildSurveyUpload(input: {
  surveyJobId: string;
  category: SurveyUploadCategory;
  fileName: string;
  storagePath: string;
  uploadedByRole: Role;
  previewUrl?: string;
}): SurveyUpload {
  return {
    id: id('upload'),
    surveyJobId: input.surveyJobId,
    category: input.category,
    fileName: input.fileName,
    storagePath: input.storagePath,
    uploadedByRole: input.uploadedByRole,
    uploadedAt: stamp(),
    previewUrl: input.previewUrl,
  };
}

export function canCompleteInstallerSurvey(uploads: SurveyUpload[], actorRole: Role, roofStructurallySound?: boolean | null) {
  if (actorRole !== 'installer') return { allowed: false, reason: 'Installer must complete survey validation.' };
  const uploaded = new Set(uploads.map((upload) => upload.category));
  const missing = requiredSurveyUploadCategories.filter((category) => !uploaded.has(category));
  if (missing.length) return { allowed: false, reason: `Missing survey evidence: ${missing.join(', ')}` };
  if (roofStructurallySound === undefined || roofStructurallySound === null) {
    return { allowed: false, reason: 'Roof structural soundness must be answered before survey completion.' };
  }
  if (roofStructurallySound === false) {
    return { allowed: false, reason: 'Roof requires engineering remediation plan before proceeding.' };
  }
  return { allowed: true, reason: 'Installer can complete survey validation.' };
}

export function buildBillingLedgerEvent(input: {
  linkedRecordId: string;
  eventType: BillingLedgerEventType;
  amount: number;
  actorRole: Role;
  note: string;
}): BillingLedgerEvent {
  return {
    id: id('ledger'),
    linkedRecordId: input.linkedRecordId,
    eventType: input.eventType,
    amount: Math.max(0, Math.round(input.amount)),
    providerMode: 'mock',
    actorRole: input.actorRole,
    note: input.note,
    createdAt: stamp(),
  };
}

export function buildReportSnapshot(deals: Deal[], actorRole: Role): AnalyticsReportSnapshot {
  const activeDeals = deals.filter((deal) => deal.archiveState !== 'archived');
  const quoteValue = activeDeals.reduce((sum, deal) => sum + (deal.proposal?.projectPrice ?? 0), 0);
  const signed = activeDeals.filter((deal) => deal.contract?.status === 'signed').length;
  const refunds = activeDeals.filter((deal) => deal.refund).length;
  return {
    id: id('report'),
    title: 'Revenue operations snapshot',
    summary: `Revenue operations summary: ${activeDeals.length} active leads, ${signed} signed contracts, ${refunds} refund requests, and ${quoteValue.toLocaleString('en-PH')} quote value.`,
    metrics: {
      activeLeads: activeDeals.length,
      signedContracts: signed,
      refundRequests: refunds,
      quoteValue,
    },
    createdByRole: actorRole,
    status: 'embedded',
    createdAt: stamp(),
  };
}

export function buildReportEmbeddingChunk(snapshot: AnalyticsReportSnapshot, embedding: number[]) {
  return {
    id: id('report-chunk'),
    reportId: snapshot.id,
    content: `${snapshot.title}\n${snapshot.summary}\n${JSON.stringify(snapshot.metrics)}`,
    embedding,
    model: 'text-embedding-3-small' as const,
    createdAt: stamp(),
  };
}
