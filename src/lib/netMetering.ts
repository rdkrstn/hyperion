import type {
  Deal,
  InstallerWorkSummary,
  NetMeteringGateResult,
  NetMeteringStep,
  NetMeteringStepId,
  NetMeteringStepStatus,
  NetMeteringWorkflow,
  RiskLevel,
} from '../types';

const stepOrder: NetMeteringStepId[] = ['eligibility', 'documents', 'technical_review', 'application', 'metering', 'active_credits'];

function stamp() {
  return new Date().toLocaleString('en-PH');
}

function hasReadinessBill(deal: Deal) {
  if (deal.dealFiles?.length) return deal.dealFiles.some((file) => file.category === 'customer_bill' && file.validationStatus === 'validated');
  return Boolean(deal.readinessIntake?.billUploadFileName) || deal.readinessUploads.some((upload) => upload.category === 'bill');
}

function hasValidatedOrLegacyDocument(deal: Deal, category: 'valid_id' | 'site_control_document') {
  if (deal.dealFiles?.length) return deal.dealFiles.some((file) => file.category === category && file.validationStatus === 'validated');
  return category === 'valid_id' ? deal.documents.validId : deal.documents.roofAccess;
}

export function missingNetMeteringItems(deal: Deal) {
  const missing = [
    !deal.readinessIntake?.utilityProvider && !deal.netMeteringWorkflow?.utilityProvider ? 'Utility/provider' : '',
    !deal.readinessIntake?.roofOwnership && !deal.netMeteringWorkflow?.ownershipFlag ? 'Roof/site control answer' : '',
    !hasReadinessBill(deal) ? 'Customer bill upload' : '',
    !hasValidatedOrLegacyDocument(deal, 'valid_id') ? 'Valid ID validation' : '',
    !hasValidatedOrLegacyDocument(deal, 'site_control_document') ? 'Title/lease or site-control validation' : '',
  ].filter(Boolean);

  return Array.from(new Set(missing));
}

function technicalReviewMissing(deal: Deal) {
  return deal.surveyJob?.completed ? [] : ['Installer technical survey'];
}

function statusFromMissing(missing: string[], completeWhenEmpty = true): NetMeteringStepStatus {
  if (!missing.length && completeWhenEmpty) return 'complete';
  return missing.length ? 'blocked' : 'in_progress';
}

function stepPatch(deal: Deal, id: NetMeteringStepId): Pick<NetMeteringStep, 'status' | 'missingItems' | 'customerLabel' | 'adminLabel'> {
  const workflow = deal.netMeteringWorkflow;
  const systemSize = workflow?.systemSizeKwp || deal.readinessResult?.recommendedSystemSizeKwp || deal.preAudit?.sizeKwp || 0;
  const utility = workflow?.utilityProvider || deal.readinessIntake?.utilityProvider || 'Utility pending';
  const ownership = workflow?.ownershipFlag || deal.readinessIntake?.roofOwnership;

  if (id === 'eligibility') {
    const missing = [
      !utility || utility === 'Utility pending' ? 'Utility/provider' : '',
      !systemSize ? 'System size' : '',
      ownership === 'rented_needs_authorization' ? 'Owner authorization' : '',
    ].filter(Boolean);
    return {
      status: statusFromMissing(missing),
      missingItems: missing,
      customerLabel: missing.length ? 'Needs review before net-metering eligibility is clear' : 'Likely eligible / needs utility review',
      adminLabel: `${utility}, ${systemSize || 'pending'} kWp, ownership flag: ${ownership ?? 'pending'}`,
    };
  }

  if (id === 'documents') {
    const missing = missingNetMeteringItems(deal);
    return {
      status: statusFromMissing(missing),
      missingItems: missing,
      customerLabel: 'Document checklist',
      adminLabel: missing.length ? `Missing docs: ${missing.join(', ')}` : 'Required bill, utility, and site-control documents ready',
    };
  }

  if (id === 'technical_review') {
    const missing = technicalReviewMissing(deal);
    return {
      status: statusFromMissing(missing),
      missingItems: missing,
      customerLabel: missing.length ? 'Installer survey needed' : 'Installer technical review complete',
      adminLabel: missing.length ? 'Engineering task pending' : 'Roof, shading, area, and access validation complete',
    };
  }

  if (id === 'application') {
    const missing = deal.proposal && deal.contract ? [] : ['Generated proposal and contract package'];
    return {
      status: missing.length ? 'not_started' : 'in_progress',
      missingItems: missing,
      customerLabel: 'Prepared for submission',
      adminLabel: missing.length ? 'DU/LGU submission status pending commercial package' : 'DU/LGU submission package can be prepared',
    };
  }

  if (id === 'metering') {
    const missing = deal.stage === 'approved' ? [] : ['Owner-approved installation timeline'];
    return {
      status: missing.length ? 'not_started' : 'in_progress',
      missingItems: missing,
      customerLabel: 'Bi-directional meter pending',
      adminLabel: 'Timeline and follow-up',
    };
  }

  return {
    status: deal.stage === 'approved' ? 'in_progress' : 'not_started',
    missingItems: deal.stage === 'approved' ? [] : ['Post-activation monitoring'],
    customerLabel: 'Track exported energy credits',
    adminLabel: 'Monitoring and support task',
  };
}

export function syncNetMeteringWorkflow(deal: Deal): NetMeteringWorkflow {
  const workflow = deal.netMeteringWorkflow;
  const now = stamp();
  const existing = new Map((workflow?.steps ?? []).map((step) => [step.id, step]));
  const steps = stepOrder.map((id) => {
    const current = existing.get(id);
    const patch = stepPatch(deal, id);
    if ((id === 'application' || id === 'metering' || id === 'active_credits') && current?.status === 'complete') {
      return current;
    }
    return {
      id,
      updatedAt: current?.status === patch.status && current?.missingItems.join('|') === patch.missingItems.join('|') ? current.updatedAt : now,
      ...patch,
    };
  });

  return {
    id: workflow?.id ?? `net-metering-${deal.id}`,
    leadId: deal.id,
    status: workflow?.status ?? (workflow?.readyForLenderAt ? 'ready_for_lender' : 'documents_pending'),
    utilityProvider: workflow?.utilityProvider || deal.readinessIntake?.utilityProvider || deal.lead.location,
    location: workflow?.location || deal.readinessIntake?.location || deal.lead.location,
    ownershipFlag: workflow?.ownershipFlag || deal.readinessIntake?.roofOwnership || 'rented_needs_authorization',
    systemSizeKwp: workflow?.systemSizeKwp || deal.readinessResult?.recommendedSystemSizeKwp || deal.preAudit?.sizeKwp || 0,
    electricalPermitSubmittedAt: workflow?.electricalPermitSubmittedAt,
    cfeiSubmittedAt: workflow?.cfeiSubmittedAt,
    readyForLenderAt: workflow?.readyForLenderAt,
    ownerReadyOverrideAt: workflow?.ownerReadyOverrideAt,
    ownerReadyOverrideReason: workflow?.ownerReadyOverrideReason,
    createdAt: workflow?.createdAt ?? now,
    steps,
  };
}

export function evaluateNetMeteringGate(deal: Deal): NetMeteringGateResult {
  if (!deal.readinessIntake && !deal.readinessResult && !deal.netMeteringWorkflow) {
    return { allowed: true, reason: 'No net-metering workflow is attached to this legacy record.', missingItems: [] };
  }
  const workflow = syncNetMeteringWorkflow(deal);
  const requiredSteps = workflow.steps.filter((step) => step.id === 'documents' || step.id === 'technical_review');
  const missingItems = requiredSteps.flatMap((step) => step.missingItems);
  const readyForLender = workflow.status === 'ready_for_lender' || Boolean(workflow.readyForLenderAt || workflow.ownerReadyOverrideAt);
  const allowed = requiredSteps.every((step) => step.status === 'complete') && readyForLender;
  return {
    allowed,
    reason: allowed
      ? 'Required net-metering documents, technical review, and lender-ready workflow are complete.'
      : `Complete net-metering requirements before proposal/CS: ${[...missingItems, readyForLender ? '' : 'Mark workflow ready for lender'].filter(Boolean).join(', ') || 'workflow review'}.`,
    missingItems: [...missingItems, readyForLender ? '' : 'Mark workflow ready for lender'].filter(Boolean),
  };
}

function summaryRisk(deal: Deal, gate: NetMeteringGateResult): RiskLevel {
  if (!gate.allowed || deal.readinessResult?.installerScorecard.riskLevel === 'high') return 'high';
  if (deal.readinessResult?.installerScorecard.riskLevel === 'medium') return 'medium';
  return 'low';
}

export function deriveInstallerWorkSummary(deal: Deal): InstallerWorkSummary {
  const base = deal.readinessResult?.installerScorecard;
  const gate = evaluateNetMeteringGate(deal);
  const workflow = syncNetMeteringWorkflow(deal);
  const documentsStep = workflow.steps.find((step) => step.id === 'documents');
  const quote = deal.quoteRequests.find((request) => !['rejected', 'cancelled'].includes(request.status));
  const missingDocuments = Array.from(new Set([...(base?.missingDocuments ?? []), ...gate.missingItems]));
  const nextBestAction = !gate.allowed
    ? `Resolve net-metering documents: ${gate.missingItems.join(', ')}.`
    : !deal.surveyJob?.completed
      ? 'Complete installer survey validation and evidence upload.'
      : quote?.status === 'approved' && !deal.checkoutEstimate
        ? 'Convert approved quote request into checkout estimate.'
        : base?.nextBestAction ?? 'Keep the opportunity moving through checkout and CS readiness.';

  return {
    leadScore: base?.leadScore ?? deal.score?.score ?? deal.qualification.score,
    monthlyBillRange: base?.billRange ?? `${deal.lead.averageMonthlyBill.toLocaleString('en-PH')} monthly bill`,
    roofReadiness: base?.roofReadiness ?? deal.lead.propertyControl,
    financingIntent: base?.financingIntent ?? deal.score?.lane?.replaceAll('_', ' ') ?? 'pending',
    missingDocuments,
    estimatedProjectValue: deal.checkoutEstimate?.total ?? deal.financingPacket?.installerQuote ?? base?.estimatedProjectValue ?? deal.preAudit?.capex ?? 0,
    riskLevel: summaryRisk(deal, gate),
    nextBestAction,
    quoteStatus: quote?.status ?? 'none',
    netMeteringStatus: documentsStep?.status ?? 'not_started',
  };
}
