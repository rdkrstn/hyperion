import type {
  ClientPortal,
  Deal,
  DealLifecycleStage,
  DealRecord,
  DocumentRecord,
  LeadLifecycleStatus,
  LeadRecord,
  ProposalOutcome,
  ProposalRecord,
  RiskLevel,
  SolarSnapshot,
  SurveyOutcome,
  SurveyRecord,
  TimelineEvent,
} from '../types';

const PHP = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });

function riskFromScore(score: number): RiskLevel {
  if (score >= 75) return 'low';
  if (score >= 55) return 'medium';
  return 'high';
}

function lifecycleFromDeal(deal: Deal): LeadLifecycleStatus {
  if (deal.stage !== 'captured') return 'deal_created';
  return deal.qualification.status === 'qualified' ? 'qualified' : 'captured';
}

function dealStageFromLegacyStage(deal: Deal): DealLifecycleStage {
  if (deal.opportunityStatus === 'won' || deal.stage === 'approved') return 'won';
  if (deal.contract?.status === 'signed') return 'contract_accepted';
  if (deal.dealRoom?.status === 'active') return 'client_portal_shared';
  if (deal.proposal) return 'proposal_built';
  if (deal.stage === 'survey_completed') return 'survey_validated';
  if (deal.stage === 'survey_assigned') return 'survey_scheduled';
  if (deal.solarInsights?.status === 'ready' || deal.solarDispatchOverride?.status === 'approved') return 'solar_snapshot_reviewed';
  return 'deal_created';
}

function proposalOutcomeFromDeal(deal: Deal): ProposalOutcome {
  if (deal.contract?.status === 'signed') return 'accepted';
  if (deal.dealRoom?.status === 'active' || deal.contract?.status === 'sent') return 'shared';
  if (deal.checkoutEstimate?.approvalStatus === 'needs_pricing_approval') return 'pricing_review_needed';
  if (deal.proposal?.status === 'ready' || deal.checkoutEstimate?.status === 'frozen') return 'approved';
  return 'draft';
}

function surveyOutcomeFromDeal(deal: Deal): SurveyOutcome {
  if (!deal.surveyJob) return 'scheduled';
  if (deal.surveyJob.roofStructurallySound === false) return 'blocked';
  if (deal.surveyApproval?.status === 'installer_validated' || deal.surveyJob.completed) return 'validated';
  if (deal.surveyUploads.length > 0) return 'evidence_pending';
  return 'scheduled';
}

function dealValue(deal: Deal) {
  return deal.proposal?.projectPrice ?? deal.checkoutEstimate?.total ?? deal.financingPacket?.installerQuote ?? deal.preAudit?.capex ?? 0;
}

function sourceUtility(deal: Deal) {
  return deal.readinessIntake?.utilityProvider ?? deal.netMeteringWorkflow?.utilityProvider ?? 'Pending utility';
}

function sourceGoal(deal: Deal) {
  if (deal.readinessIntake?.budgetPreference === 'lease_to_own') return 'Financing / lease-to-own interest';
  if (deal.readinessIntake?.batteryInterest) return 'Bill reduction plus backup readiness';
  return deal.lead.interestLevel;
}

function missingRequirements(deal: Deal) {
  const sectionLabels = deal.qualification.missingSections.map((section) => section.replaceAll('_', ' '));
  const docs = [
    deal.documents.electricBills ? '' : 'electric bill',
    deal.documents.locationPin || deal.geoPin?.latitude ? '' : 'confirmed location',
    deal.documents.roofAccess || deal.lead.propertyControl !== 'Rents / no authorization yet' ? '' : 'site-control proof',
  ].filter(Boolean);
  return [...sectionLabels, ...docs];
}

export function leadRecordFromDeal(deal: Deal): LeadRecord {
  const score = deal.readinessResult?.readinessScore ?? deal.score?.score ?? deal.qualification.score;
  const systemSize = deal.readinessResult?.recommendedSystemSizeKwp ?? deal.preAudit?.sizeKwp ?? 0;
  const savingsLow = deal.readinessResult?.monthlySavingsLow ?? Math.round((deal.preAudit?.projectedSavings ?? 0) * 0.75);
  const savingsHigh = deal.readinessResult?.monthlySavingsHigh ?? deal.preAudit?.projectedSavings ?? 0;
  const missing = missingRequirements(deal);

  return {
    id: deal.id,
    code: deal.code,
    lifecycleStatus: lifecycleFromDeal(deal),
    source: deal.lead.source,
    businessName: deal.lead.businessName,
    contactName: deal.lead.contactName,
    contactInfo: deal.lead.contactName,
    location: deal.lead.location,
    utilityProvider: sourceUtility(deal),
    customerType: deal.lead.businessType,
    monthlyBill: deal.lead.averageMonthlyBill,
    monthlyKwh: deal.preAudit?.monthlyKwh,
    daytimeUsage: deal.readinessIntake?.daytimeUsageLevel ?? 'needs review',
    operatingHours: deal.readinessIntake?.operatingHours ?? 'needs review',
    brownoutConcern: deal.readinessIntake?.batteryInterest ?? false,
    batteryInterest: deal.readinessIntake?.batteryInterest ?? false,
    currentBackupSetup: deal.readinessIntake?.batteryInterest ? 'Battery interest noted' : 'Not captured',
    goal: sourceGoal(deal),
    siteControl: deal.lead.propertyControl,
    paymentPreference: deal.score?.lane?.replaceAll('_', ' ') ?? deal.readinessIntake?.budgetPreference?.replaceAll('_', ' ') ?? 'needs review',
    qualification: deal.qualification,
    readinessScore: score,
    solarFit: score >= 75 ? 'Strong fit' : score >= 55 ? 'Needs review' : 'Nurture',
    recommendedSystemRange: systemSize ? `${Math.max(1, Math.floor(systemSize * 0.85))}-${Math.ceil(systemSize * 1.15)} kWp` : 'Pending bill OCR',
    estimatedSavingsRange: `${PHP.format(savingsLow)}-${PHP.format(savingsHigh)} / month`,
    paybackEstimate: deal.readinessResult ? `${deal.readinessResult.paybackYearsLow}-${deal.readinessResult.paybackYearsHigh} years` : `${deal.preAudit?.paybackYears ?? 0} years`,
    riskLevel: riskFromScore(score),
    missingRequirements: missing,
    nextBestAction: missing.length ? `Clear ${missing[0]}.` : 'Create deal and prepare Solar Snapshot review.',
    assignedSales: deal.assignedSales || 'Unassigned',
    createdAt: deal.events.at(-1)?.createdAt ?? deal.events[0]?.createdAt ?? 'Not recorded',
  };
}

export function canCreateDealFromLead(lead: LeadRecord) {
  const missing = [
    lead.contactName ? '' : 'contact',
    lead.location ? '' : 'location',
    lead.monthlyBill || lead.monthlyKwh ? '' : 'bill or estimated bill',
    lead.goal ? '' : 'goal',
    lead.siteControl ? '' : 'site-control answer',
  ].filter(Boolean);
  return {
    allowed: missing.length === 0,
    missing,
  };
}

export function dealRecordFromDeal(deal: Deal): DealRecord {
  const lead = leadRecordFromDeal(deal);
  const proposalStatus = proposalOutcomeFromDeal(deal);
  const surveyStatus = surveyOutcomeFromDeal(deal);

  return {
    id: deal.id,
    name: `${deal.lead.businessName} solar project`,
    leadId: lead.id,
    leadSnapshot: {
      leadId: lead.id,
      businessName: lead.businessName,
      contactName: lead.contactName,
      location: lead.location,
      monthlyBill: lead.monthlyBill,
      goal: lead.goal,
      utilityProvider: lead.utilityProvider,
      paymentPreference: lead.paymentPreference,
      readinessScore: lead.readinessScore,
    },
    value: dealValue(deal),
    stage: dealStageFromLegacyStage(deal),
    status: deal.opportunityStatus,
    source: deal.lead.source,
    salesOwner: deal.assignedSales || 'Unassigned',
    createdAt: deal.events.at(-1)?.createdAt ?? deal.events[0]?.createdAt ?? 'Not recorded',
    expectedCloseDate: deal.lead.purchaseTimeline,
    surveyStatus,
    proposalStatus,
    portalStatus: deal.dealRoom?.status ?? 'not_shared',
    winLossStatus: deal.opportunityStatus,
    commercialPacket: {
      proposedSystemSizeKwp: deal.checkoutEstimate?.lineItems.find((line) => line.category === 'panel')?.quantity ?? deal.preAudit?.sizeKwp ?? 0,
      packageName: deal.checkoutEstimate ? 'Formal solar scope' : 'Pending scope',
      addOns: deal.checkoutEstimate?.lineItems.filter((line) => line.optional).map((line) => line.name) ?? [],
      estimatedPrice: dealValue(deal),
      marginEstimate: deal.checkoutEstimate?.grossMarginPercent ?? deal.proposal?.grossMarginPercent ?? 0,
      paymentOption: deal.checkoutEstimate?.paymentMethod.replaceAll('_', ' ') ?? lead.paymentPreference,
      discounts: 0,
      proposalStatus,
      contractStatus: deal.contract?.status ?? 'not_started',
    },
    blocker: lead.missingRequirements[0],
    nextAction: lead.missingRequirements[0] ? `Clear ${lead.missingRequirements[0]}` : 'Advance the next stage gate',
  };
}

export function solarSnapshotFromDeal(deal: Deal): SolarSnapshot | undefined {
  const insight = deal.solarInsights;
  if (!insight && !deal.geoPin && !deal.geoAddress) return undefined;
  return {
    id: insight?.id ?? `solar-snapshot-${deal.id}`,
    leadId: deal.id,
    dealId: deal.stage === 'captured' ? undefined : deal.id,
    placeId: deal.geoAddress?.placeId,
    latitude: deal.geoPin?.latitude,
    longitude: deal.geoPin?.longitude,
    utilityProvider: sourceUtility(deal),
    imageryStatus: insight?.status ?? 'maps_pending',
    imageryQuality: insight?.imageryQuality ?? 'Pending',
    roofCapacityKwp: insight?.maxSystemSizeKwp ?? 0,
    maxPanels: insight?.maxPanels ?? 0,
    annualProductionKwh: insight?.yearlyEnergyDcKwh ?? 0,
    pitch: insight?.roofPitchDegrees ?? insight?.roofSegments[0]?.pitchDegrees,
    azimuth: insight?.roofSegments[0]?.azimuthDegrees,
    shadingFlag: (insight?.riskFlags ?? []).some((flag) => flag.toLowerCase().includes('shading')),
    riskFlag: insight?.riskFlags[0] ?? (insight?.status === 'ready' ? 'No Solar API risk flag' : 'Solar Snapshot pending'),
    dispatchGate: insight?.ownerOverrideAt ? 'override_approved' : insight?.status ?? 'maps_pending',
    manualOverrideStatus: deal.solarDispatchOverride?.status === 'approved' ? 'override_approved' : undefined,
    lastReviewedAt: insight?.verifiedAt ?? insight?.createdAt,
  };
}

export function surveyRecordFromDeal(deal: Deal): SurveyRecord | undefined {
  if (!deal.surveyJob) return undefined;
  const evidenceStatus = surveyOutcomeFromDeal(deal);
  return {
    id: deal.surveyJob.id,
    dealId: deal.id,
    leadId: deal.id,
    installer: deal.surveyJob.assignedInstaller,
    schedule: deal.surveyJob.scheduledAt,
    location: deal.lead.location,
    mapPin: deal.surveyJob.mapPin,
    accessInstructions: deal.surveyJob.siteAccessNotes,
    solarSnapshotId: solarSnapshotFromDeal(deal)?.id,
    evidenceStatus,
    validationOutcome: deal.surveyJob.completed ? 'ready_for_proposal' : evidenceStatus,
    blockers: deal.surveyJob.roofStructurallySound === false ? ['Roof requires engineering remediation plan'] : [],
    roofCondition: deal.surveyJob.roofCondition,
    electricalPanelCondition: deal.surveyJob.installerValidationPayload?.main_breaker_photo ? 'Evidence uploaded' : 'Pending main breaker evidence',
    wireRunComplexity: deal.surveyJob.installerValidationPayload?.wire_run_path_photo ? 'Wire run path documented' : 'Pending wire run evidence',
    safetyRisks: deal.surveyJob.roofCondition === 'Engineering review required' ? ['Engineering review required'] : [],
    recommendedSystemAdjustment: deal.surveyJob.usableRoofArea,
    requiresEngineerReview: deal.surveyJob.roofCondition === 'Engineering review required',
    installerNotes: deal.surveyJob.siteAccessNotes,
  };
}

export function documentRecordsFromDeal(deal: Deal): DocumentRecord[] {
  return (deal.dealFiles ?? []).map((file) => ({
    id: file.id,
    ownerType: 'deal',
    ownerId: deal.id,
    category: file.category,
    fileName: file.fileName,
    mimeType: file.mimeType,
    bucket: file.bucket,
    storagePath: file.storagePath,
    source: file.source,
    validationStatus: file.validationStatus,
    uploadedAt: file.uploadedAt,
    validatedAt: file.validatedAt,
    rejectionReason: file.rejectionReason,
  }));
}

export function proposalRecordFromDeal(deal: Deal): ProposalRecord | undefined {
  if (!deal.checkoutEstimate && !deal.proposal) return undefined;
  return {
    id: deal.checkoutEstimate?.id ?? deal.proposal?.id ?? `proposal-${deal.id}`,
    dealId: deal.id,
    status: proposalOutcomeFromDeal(deal),
    scopeLines: deal.checkoutEstimate?.lineItems ?? [],
    total: deal.checkoutEstimate?.total ?? deal.proposal?.projectPrice ?? 0,
    marginPercent: deal.checkoutEstimate?.grossMarginPercent ?? deal.proposal?.grossMarginPercent ?? 0,
    paymentOption: deal.checkoutEstimate?.paymentMethod ?? 'bank_transfer',
    contractReady: deal.checkoutEstimate?.status === 'frozen' && deal.checkoutEstimate.approvalStatus !== 'needs_pricing_approval',
    clientFacingState: deal.contract?.status === 'signed' ? 'accepted' : deal.dealRoom ? 'shared' : 'not_shared',
  };
}

export function clientPortalFromDeal(deal: Deal): ClientPortal | undefined {
  if (!deal.dealRoom) return undefined;
  return {
    id: deal.dealRoom.id,
    dealId: deal.id,
    token: deal.dealRoom.token,
    publicUrl: deal.dealRoom.publicUrl,
    status: deal.dealRoom.status,
    lastViewedAt: deal.dealRoom.events.find((event) => event.eventType === 'viewed')?.createdAt,
    documentsUploaded: deal.remoteIntakeLink?.uploads.length ?? 0,
    proposalAccepted: deal.proposal?.status === 'accepted',
    contractSigned: deal.contract?.status === 'signed',
  };
}

export function timelineFromDeal(deal: Deal): TimelineEvent[] {
  return deal.events.map((event) => ({
    id: event.id,
    ownerType: 'deal',
    ownerId: deal.id,
    title: event.stage.replaceAll('_', ' '),
    description: event.note,
    actorRole: event.actorRole,
    createdAt: event.createdAt,
  }));
}
