import { useMemo, useState } from 'react';
import { computeAnalytics } from '../lib/analytics';
import {
  buildBillingLedgerEvent,
  buildCalendarEvent,
  buildReportEmbeddingChunk,
  buildReportSnapshot,
  buildSurveyUpload,
  buildTicket,
  canCompleteInstallerSurvey,
  defaultQualification,
  scoreQualification,
} from '../lib/coreOps';
import {
  createAcceptedInvoice,
  createCheckoutEstimate,
  createContractRecord,
  createMockBillingTransaction,
  updateEstimateBilling,
} from '../lib/checkout';
import {
  addQuoteLine,
  approvePricing as approveQuotePricing,
  createQuoteDraft,
  freezeCheckoutEstimate,
  removeQuoteLine,
  updateQuoteLine,
} from '../lib/quoteBuilder';
import { evaluateCheckoutPreflight } from '../lib/checkoutPreflight';
import { createDealRoom, recordDealRoomEvent, requestDealRoomQuote } from '../lib/dealRoom';
import { normalizeBillOcrResult, runFieldPreAudit } from '../lib/fieldAutomation';
import { failure, success } from '../lib/actionFeedback';
import { calculatePreAudit, scoreLead } from '../lib/scoring';
import { canSetRefundStatus } from '../lib/refunds';
import { canAdvanceStage, isInstallerSurveyValidated } from '../lib/stageGates';
import { buildFinancingPacket, buildNetMeteringWorkflow, buildReadinessUploads, calculateReadinessResult, canRemoveLead, readinessToLeadInput, sampleReadinessIntake } from '../lib/readiness';
import { evaluateNetMeteringGate, syncNetMeteringWorkflow } from '../lib/netMetering';
import { buildMapsPendingSnapshot, buildStaticMapUrl } from '../lib/geoSolar';
import { buildInstallerValidationPayload } from '../lib/surveyGate';
import { createComplianceDocuments, defaultComplianceRule, hasRequiredComplianceDocuments, markWorkflowReadyForLender } from '../lib/compliance';
import { buildDealFile, createSignedDownloadUrl, rejectDealFile, validateDealFile } from '../lib/fileVault';
import {
  approveSolarDispatchOverride,
  assignAndScheduleSurveyJob,
  evaluateSolarDispatchGate,
  requestSolarDispatchOverride as requestSolarDispatchOverrideRecord,
} from '../lib/solarDispatch';
import {
  createRemoteIntakeLink,
  markRemoteIntakeSent as markRemoteIntakeSentRecord,
  recordRemoteIntakeUpload as recordRemoteIntakeUploadRecord,
} from '../lib/remoteIntake';
import {
  approveQuoteRequest,
  cancelQuoteRequest,
  convertQuoteRequestToCheckout,
  createQuoteRequest,
  rejectQuoteRequest,
} from '../lib/quoteRequests';
import { buildNotification } from '../lib/notifications';
import { applySelfProfileUpdate } from '../lib/profiles';
import { canSetOpportunityStatus } from '../lib/opportunities';
import type {
  ActionResult,
  AnalyticsReportSnapshot,
  BillingAmountType,
  BillingLedgerEventType,
  CalendarEvent,
  ClientFormInput,
  ClientRecord,
  Deal,
  DealFileCategory,
  EstimateLineItem,
  LeadFormInput,
  LinkedRecordType,
  NotificationRecord,
  PaymentMethod,
  QualificationAnswerMap,
  NetMeteringStepId,
  NetMeteringStepStatus,
  ReadinessIntake,
  RemoteIntakeUploadCategory,
  RefundStatus,
  Role,
  StaffProfile,
  SurveyUploadCategory,
  DealRoomQuoteRequestInput,
  TicketCategory,
  TicketPriority,
  TicketRecord,
} from '../types';

function eventId() {
  return `event-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function addEvent(deal: Deal, actorRole: Role, note: string, stage = deal.stage): Deal {
  return {
    ...deal,
    events: [
      { id: eventId(), stage, actorRole, note, createdAt: new Date().toLocaleString('en-PH') },
      ...deal.events,
    ],
  };
}

function updateDeal(deal: Deal, patch: Partial<Deal>, actorRole: Role, note: string): Deal {
  const next = { ...deal, ...patch };
  return addEvent(next, actorRole, note, next.stage);
}

function contractOrigin() {
  return typeof window === 'undefined' ? 'http://127.0.0.1:5173' : window.location.origin;
}

export function useSolarOpsData() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [reportSnapshots, setReportSnapshots] = useState<AnalyticsReportSnapshot[]>([]);

  const analytics = useMemo(() => computeAnalytics(deals), [deals]);

  function mutateDeal(id: string, updater: (deal: Deal) => Deal) {
    setDeals((current) => current.map((deal) => (deal.id === id ? updater(deal) : deal)));
  }

  function routePlanForDeals(currentDeals: Deal[]) {
    const jobs = currentDeals
      .filter((deal) => deal.stage === 'survey_assigned' && deal.surveyJob)
      .map((deal) => ({
        dealId: deal.id,
        surveyJobId: deal.surveyJob?.id ?? '',
        label: deal.lead.businessName,
        latitude: deal.geoPin?.latitude ?? deal.readinessIntake?.latitude,
        longitude: deal.geoPin?.longitude ?? deal.readinessIntake?.longitude,
      }));

    if (!jobs.length) return undefined;
    return {
      id: `route-local-${Date.now()}`,
      installerId: 'Solar Installer Team',
      status: jobs.some((job) => !job.latitude || !job.longitude) ? 'maps_pending' as const : 'ready' as const,
      origin: { latitude: jobs[0].latitude, longitude: jobs[0].longitude },
      orderedStops: jobs.map((job, index) => ({
        ...job,
        durationMinutes: job.latitude && job.longitude ? 18 + index * 12 : undefined,
        distanceKm: job.latitude && job.longitude ? 4 + index * 5 : undefined,
      })),
      createdAt: new Date().toLocaleString('en-PH'),
    };
  }

  function createLead(input: LeadFormInput = readinessToLeadInput(sampleReadinessIntake)) {
    const id = `lead-${String(deals.length + 1).padStart(3, '0')}-${Date.now()}`;
    const deal: Deal = {
      id,
      code: `SOL-${String(deals.length + 1).padStart(3, '0')}`,
      stage: 'captured',
      opportunityStatus: 'open',
      archiveState: 'active',
      lead: input,
      qualification: defaultQualification(input),
      assignedSales: '',
      readinessUploads: [],
      dealFiles: [],
      documents: {
        electricBills: false,
        businessRegistration: false,
        validId: false,
        locationPin: false,
        roofAccess: false,
      },
      billingLedger: [],
      surveyUploads: [],
      quoteRequests: [],
      csReady: false,
      tasks: [
        { id: `${id}-task-1`, ownerRole: 'sales', title: 'Confirm bill and decision maker', status: 'open', dueLabel: 'Today' },
        { id: `${id}-task-2`, ownerRole: 'cs', title: 'Prepare required document request', status: 'open', dueLabel: 'After proposal' },
      ],
      aiSuggestions: [
        {
          id: `${id}-ai-1`,
          type: 'summary',
          title: 'Lead summary draft',
          body: `${input.businessName} came from ${input.source} and needs qualification before survey assignment.`,
          approved: false,
        },
      ],
      events: [{ id: eventId(), stage: 'captured', actorRole: 'sales', note: 'Lead captured from intake.', createdAt: new Date().toLocaleString('en-PH') }],
    };
    setDeals((current) => [deal, ...current]);
    setNotifications((current) => [
      buildNotification({
        title: 'New lead created',
        body: `${input.businessName} needs qualification and readiness review.`,
        targetRole: 'sales',
        linkedRecordType: 'lead',
        linkedRecordId: id,
        severity: 'info',
      }),
      ...current,
    ]);
    return id;
  }

  function createReadinessLead(input: ReadinessIntake, actorRole: Role = 'sales') {
    const leadInput = readinessToLeadInput(input);
    const id = createLead(leadInput);
    const ocrResult = input.billUploadFileName
      ? normalizeBillOcrResult({
        provider: 'google_vision',
        confidence: 0.82,
        text: `${input.utilityProvider} 12-month average ${Math.round(input.monthlyElectricityBill / 11).toLocaleString('en-PH')} kWh Amount due PHP ${input.monthlyElectricityBill.toLocaleString('en-PH')}`,
      })
      : undefined;
    const ocrAdjustedInput = ocrResult
      ? {
        ...input,
        monthlyElectricityBill: ocrResult.monthlyBillAmount || input.monthlyElectricityBill,
        utilityProvider: ocrResult.utilityProvider || input.utilityProvider,
      }
      : input;
    const readinessResult = calculateReadinessResult(ocrAdjustedInput);
    const readinessUploads = buildReadinessUploads(id, ocrAdjustedInput);
    const netMeteringWorkflow = { ...buildNetMeteringWorkflow(ocrAdjustedInput, readinessResult.recommendedSystemSizeKwp), leadId: id };
    const financingPacket = { ...buildFinancingPacket(ocrAdjustedInput, readinessResult), leadId: id };
    const preAuditRun = runFieldPreAudit({ leadId: id, intake: ocrAdjustedInput, readiness: readinessResult, financingPacket, ocrResult });
    const fitScore = scoreLead(leadInput);
    const browserMapKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined;

    mutateDeal(id, (deal) => updateDeal(
      deal,
      (() => {
        const mapsSnapshot = buildMapsPendingSnapshot({ ...deal, readinessIntake: ocrAdjustedInput }, 'Server-side Google Maps/Solar enrichment pending.');
        const staticMapUrl = buildStaticMapUrl({
          latitude: ocrAdjustedInput.latitude,
          longitude: ocrAdjustedInput.longitude,
          apiKey: browserMapKey,
        });
        return {
        stage: preAuditRun.nextStage,
        readinessIntake: ocrAdjustedInput,
        readinessResult,
        readinessUploads,
        dealFiles: [
          ...readinessUploads.map((upload) => buildDealFile({
            dealId: id,
            category: 'customer_bill',
            fileName: upload.fileName,
            mimeType: upload.fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
            uploadedByRole: actorRole,
            storagePath: upload.storagePath,
            source: 'staff_upload',
          })),
          ...(deal.dealFiles ?? []),
        ],
        geoAddress: {
          formattedAddress: ocrAdjustedInput.location,
          source: 'manual',
          status: 'maps_pending',
        },
        geoPin: {
          ...mapsSnapshot.geoPin,
          latitude: ocrAdjustedInput.latitude,
          longitude: ocrAdjustedInput.longitude,
          accuracyMeters: ocrAdjustedInput.locationAccuracyMeters,
          confidence: ocrAdjustedInput.latitude && ocrAdjustedInput.longitude ? (ocrAdjustedInput.locationConfidence ?? 'gps') : 'maps_pending',
          staticMapUrl,
        },
        solarInsights: mapsSnapshot.solarInsights,
        netMeteringWorkflow,
        complianceRule: defaultComplianceRule,
        complianceDocuments: deal.complianceDocuments ?? [],
        complianceHolidays: deal.complianceHolidays ?? [],
        financingPacket,
        preAudit: preAuditRun.nextStage === 'pre_audit_done' ? preAuditRun.preAudit : deal.preAudit,
        preAuditRuns: [preAuditRun, ...(deal.preAuditRuns ?? [])],
        score: preAuditRun.nextStage === 'pre_audit_done' ? { ...fitScore, priority: true } : fitScore,
        billOcrJob: ocrResult ? {
          id: `ocr-${id}`,
          leadId: id,
          provider: 'google_vision',
          sourceFileName: ocrAdjustedInput.billUploadFileName ?? 'bill-upload',
          status: ocrResult.manualReviewRequired ? 'manual_review' : 'completed',
          result: ocrResult,
          createdAt: new Date().toLocaleString('en-PH'),
        } : undefined,
        automationEvents: [...preAuditRun.automationEvents, ...(deal.automationEvents ?? [])],
        assignedSales: input.assignedSales ?? deal.assignedSales,
        financingReview: {
          id: `fin-${id}`,
          lane: ocrAdjustedInput.budgetPreference === 'cash' ? 'cash' : ocrAdjustedInput.budgetPreference === 'lease_to_own' ? 'rent_to_own' : ocrAdjustedInput.budgetPreference === 'group_buy' ? 'starter' : 'partner_loan',
          reviewStatus: financingPacket.status === 'ready_for_lender' ? 'packet_ready' : 'not_started',
          missingDocs: financingPacket.missingRequirements,
          packetSummary: `${readinessResult.readinessScore}/100 readiness score. ${financingPacket.status.replaceAll('_', ' ')}.`,
        },
        surveyApproval: preAuditRun.nextStage === 'pre_audit_done'
          ? {
            id: `approval-survey-${id}`,
            surveyJobId: `survey-${id}`,
            status: 'pending_uploads',
            notes: 'Installer evidence upload required before survey completion.',
            updatedAt: new Date().toLocaleString('en-PH'),
          }
          : deal.surveyApproval,
      };
      })(),
      actorRole,
      preAuditRun.nextStage === 'pre_audit_done'
        ? 'Field intake, bill OCR, readiness score, and pre-audit completed.'
        : 'Solar readiness intake completed and navigator outputs generated.',
    ));

    const roleAlerts: NotificationRecord[] = [
      buildNotification({
        title: 'Qualification needed',
        body: `${ocrAdjustedInput.businessName} submitted a readiness intake with ${readinessResult.readinessScore}/100 score.`,
        targetRole: 'sales',
        linkedRecordType: 'lead',
        linkedRecordId: id,
        severity: readinessResult.readinessScore >= 70 ? 'success' : 'warning',
      }),
      buildNotification({
        title: 'Readiness packet created',
        body: `${ocrAdjustedInput.businessName} has a ${financingPacket.status.replaceAll('_', ' ')} lender packet.`,
        targetRole: 'cs',
        linkedRecordType: 'financing',
        linkedRecordId: id,
        severity: financingPacket.status === 'ready_for_lender' ? 'success' : 'warning',
      }),
      buildNotification({
        title: 'Installer survey priority',
        body: `${ocrAdjustedInput.businessName} survey priority is ${readinessResult.installerSurveyPriority}.`,
        targetRole: 'installer',
        linkedRecordType: 'survey',
        linkedRecordId: id,
        severity: readinessResult.installerSurveyPriority === 'high' ? 'warning' : 'info',
      }),
    ];
    setNotifications((current) => [...roleAlerts, ...current]);
    return id;
  }

  function createPublicInquiry(input: ReadinessIntake) {
    return createReadinessLead(input, 'sales');
  }

  function updateLead(id: string, input: Partial<LeadFormInput>, actorRole: Role = 'sales') {
    mutateDeal(id, (deal) => updateDeal(deal, { lead: { ...deal.lead, ...input } }, actorRole, 'Lead details updated.'));
  }

  function qualifyLead(id: string, answers: QualificationAnswerMap, actorRole: Role = 'sales', overrideNote = '') {
    mutateDeal(id, (deal) => {
      const qualification = scoreQualification(deal.lead, answers, overrideNote);
      return updateDeal(
        deal,
        {
          qualification,
          opportunityStatus: qualification.status === 'qualified' ? 'open' : deal.opportunityStatus,
        },
        actorRole,
        `Qualification updated to ${qualification.status.replaceAll('_', ' ')}.`,
      );
    });
  }

  function archiveLead(id: string, actorRole: Role = 'sales') {
    mutateDeal(id, (deal) => updateDeal(deal, { archiveState: 'archived', archivedAt: new Date().toLocaleString('en-PH'), opportunityStatus: 'archived' }, actorRole, 'Lead archived. Operational records preserved.'));
  }

  function removeLead(id: string, actorRole: Role = 'sales') {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return { ok: false, error: 'Lead not found.' };
    const hasOperationalRecords = Boolean(
      deal.preAudit
      || deal.score
      || deal.surveyJob
      || deal.checkoutEstimate
      || deal.contract
      || deal.proposal
      || deal.invoice
      || deal.billingTransaction
      || deal.billingLedger.length
      || deal.surveyUploads.length
      || deal.readinessUploads.length
      || deal.financingPacket
      || deal.netMeteringWorkflow
      || deal.dealRoom
      || deal.remoteIntakeLink
      || deal.billOcrJob
      || deal.preAuditRuns?.length
      || deal.automationEvents?.length
    );
    const gate = canRemoveLead({ stage: deal.stage, hasOperationalRecords });
    if (!gate.allowed) {
      archiveLead(id, actorRole);
      return { ok: false, error: gate.reason };
    }
    setDeals((current) => current.filter((item) => item.id !== id));
    setNotifications((current) => current.filter((item) => item.linkedRecordId !== id));
    return { ok: true };
  }

  function restoreLead(id: string, actorRole: Role = 'sales') {
    mutateDeal(id, (deal) => updateDeal(deal, { archiveState: 'active', archivedAt: undefined, opportunityStatus: deal.opportunityStatus === 'archived' ? 'open' : deal.opportunityStatus }, actorRole, 'Lead restored from archive.'));
  }

  function createClient(input: ClientFormInput) {
    const id = `client-${Date.now()}`;
    const client: ClientRecord = {
      id,
      ...input,
      archiveState: 'active',
    };
    setClients((current) => [client, ...current]);
    return id;
  }

  function updateClient(id: string, input: Partial<ClientFormInput>) {
    setClients((current) => current.map((client) => (client.id === id ? { ...client, ...input } : client)));
  }

  function archiveClient(id: string) {
    setClients((current) => current.map((client) => (client.id === id ? { ...client, archiveState: 'archived', archivedAt: new Date().toLocaleString('en-PH') } : client)));
  }

  function restoreClient(id: string) {
    setClients((current) => current.map((client) => (client.id === id ? { ...client, archiveState: 'active', archivedAt: undefined } : client)));
  }

  function linkClientToDeal(clientId: string, dealId: string) {
    setClients((current) => current.map((client) => (client.id === clientId ? { ...client, linkedDealId: dealId } : client)));
  }

  function runPreAudit(id: string, actorRole: Role) {
    mutateDeal(id, (deal) => {
      const preAudit = calculatePreAudit(deal.lead);
      const score = scoreLead(deal.lead);
      const stage = score.priority ? 'pre_audit_done' : 'nurture';
      return updateDeal(
        deal,
        {
          preAudit,
          score,
          stage,
          financingReview: {
            id: `fin-${deal.id}`,
            lane: score.lane,
            reviewStatus: score.priority ? 'packet_ready' : 'not_eligible',
            missingDocs: score.priority ? ['Latest 3 electric bills', 'Business registration'] : ['Reactivation trigger'],
            packetSummary: score.priority
              ? `${score.score}/100 fit score. Prepare financing packet and survey handoff.`
              : `${score.score}/100 fit score. Keep in nurture until readiness improves.`,
          },
          financingPacket: deal.financingPacket,
          surveyApproval: {
            id: `approval-survey-${deal.id}`,
            surveyJobId: `survey-${deal.id}`,
            status: 'pending_uploads',
            notes: 'Installer evidence upload required before survey completion.',
            updatedAt: new Date().toLocaleString('en-PH'),
          },
        },
        actorRole,
        score.priority ? 'Pre-audit completed and lead qualified for handoff.' : 'Pre-audit completed and lead routed to nurture.',
      );
    });
  }

  function runSolarEnrichment(id: string, actorRole: Role): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    const latitude = deal.geoPin?.latitude ?? deal.readinessIntake?.latitude;
    const longitude = deal.geoPin?.longitude ?? deal.readinessIntake?.longitude;
    if (!latitude || !longitude) {
      const pending = buildMapsPendingSnapshot(deal, 'Confirmed rooftop pin is required before Solar API review.');
      const updated = updateDeal(deal, pending, actorRole, 'Solar API review pending until rooftop pin is confirmed.');
      setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
      return failure('Confirm the rooftop pin before Solar API roof review.');
    }
    const preAuditSize = deal.preAudit?.sizeKwp ?? deal.readinessResult?.recommendedSystemSizeKwp ?? 8;
    const maxPanels = Math.max(1, Math.ceil(preAuditSize / 0.58) + 4);
    const maxSystemSizeKwp = Number((maxPanels * 0.58).toFixed(2));
    const now = new Date().toLocaleString('en-PH');
    const staticMapUrl = buildStaticMapUrl({ latitude, longitude, apiKey: import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined });
    const updated = updateDeal(
      deal,
      {
        geoAddress: {
          formattedAddress: deal.readinessIntake?.standardizedAddress || deal.readinessIntake?.location || deal.lead.location,
          placeId: deal.readinessIntake?.placeId,
          source: deal.readinessIntake?.placeId ? 'places' : 'manual',
          status: 'ready',
        },
        geoPin: {
          latitude,
          longitude,
          accuracyMeters: deal.readinessIntake?.locationAccuracyMeters,
          confidence: 'pin_confirmed',
          staticMapUrl,
        },
        solarInsights: {
          id: `solar-${deal.id}`,
          status: 'ready',
          sourceName: 'Local Solar API review',
          imageryQuality: 'HIGH',
          maxUsableAreaMeters2: Number((maxPanels * 2.6).toFixed(1)),
          historicalIrradiance: 1450,
          roofPitchDegrees: 12,
          roofAreaMeters2: Number((maxPanels * 2.8).toFixed(1)),
          maxPanels,
          panelCapacityWatts: 580,
          maxSystemSizeKwp,
          maxSunshineHoursPerYear: 1450,
          yearlyEnergyDcKwh: Math.round(maxSystemSizeKwp * 1450),
          roofSegments: [{ pitchDegrees: 12, azimuthDegrees: 180, areaMeters2: Number((maxPanels * 2.8).toFixed(1)) }],
          riskFlags: maxSystemSizeKwp < preAuditSize ? [`Solar API caps pre-audit size from ${preAuditSize} kWp to ${maxSystemSizeKwp} kWp.`] : [],
          verifiedAt: now,
          createdAt: now,
        },
      },
      actorRole,
      'Solar API roof review completed from confirmed pin.',
    );
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    return success('Solar roof review completed.', updated.solarInsights);
  }

  function requestSolarDispatchOverride(id: string, actorRole: Role, reason = 'Solar API unavailable; requesting manual survey dispatch review.'): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    try {
      const requested = updateDeal(requestSolarDispatchOverrideRecord(deal, actorRole, reason), {}, actorRole, `Solar API dispatch override requested: ${reason}`);
      setDeals((current) => current.map((item) => (item.id === id ? requested : item)));
      setNotifications((current) => [
        buildNotification({
          title: 'Solar dispatch override requested',
          body: `${deal.lead.businessName} needs owner/manager review before site visit.`,
          targetRole: 'manager',
          linkedRecordType: 'lead',
          linkedRecordId: id,
          severity: 'warning',
        }),
        buildNotification({
          title: 'Solar dispatch override requested',
          body: `${deal.lead.businessName} needs owner/manager review before site visit.`,
          targetRole: 'owner',
          linkedRecordType: 'lead',
          linkedRecordId: id,
          severity: 'warning',
        }),
        ...current,
      ]);
      return success('Solar dispatch override requested.', requested.solarDispatchOverride);
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Unable to request Solar dispatch override.');
    }
  }

  function approveSolarDispatch(id: string, actorRole: Role, reason = 'Manual dispatch approved after roof pin review.'): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    try {
      const approved = updateDeal(approveSolarDispatchOverride(deal, actorRole, reason), {}, actorRole, `Solar API manual dispatch approved: ${reason}`);
      setDeals((current) => current.map((item) => (item.id === id ? approved : item)));
      return success('Solar dispatch override approved.', approved.solarDispatchOverride);
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Unable to approve Solar dispatch override.');
    }
  }

  function assignAndScheduleSurvey(id: string, actorRole: Role, input: { assignedInstaller: string; scheduledAt: string; location: string; notes?: string }): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    if (deal.surveyJob) return failure('Survey is already assigned for this deal.');
    const gate = canAdvanceStage(deal, 'survey_assigned');
    if (!gate.allowed) {
      mutateDeal(id, (currentDeal) => addEvent(currentDeal, actorRole, `Blocked: ${gate.reason}`));
      return failure(gate.reason);
    }
    const dispatchGate = evaluateSolarDispatchGate(deal, actorRole);
    if (!dispatchGate.allowed) {
      mutateDeal(id, (currentDeal) => addEvent(currentDeal, actorRole, `Blocked: ${dispatchGate.reason}`));
      return failure(dispatchGate.reason);
    }
    let scheduled;
    try {
      scheduled = assignAndScheduleSurveyJob(deal, actorRole, input);
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Unable to assign and schedule survey.');
    }
    const updated = updateDeal(
      scheduled.deal,
      {
        installerRoutePlan: routePlanForDeals([...deals.filter((item) => item.id !== id), scheduled.deal]),
      },
      actorRole,
      'Sales assigned and scheduled installer survey after Solar API review.',
    );
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    setCalendarEvents((current) => [scheduled.calendarEvent, ...current]);
    setNotifications((current) => [
      buildNotification({
        title: 'Survey assigned',
        body: `${deal.lead.businessName} is scheduled for installer validation at ${input.scheduledAt}.`,
        targetRole: 'installer',
        linkedRecordType: 'survey',
        linkedRecordId: id,
        severity: 'info',
      }),
      ...current,
    ]);
    return success('Survey assigned and scheduled.', updated.surveyJob);
  }

  function assignSurvey(id: string, actorRole: Role): ActionResult {
    const deal = deals.find((item) => item.id === id);
    return assignAndScheduleSurvey(id, actorRole, {
      assignedInstaller: deal?.surveyJob?.assignedInstaller ?? 'Solar Installer Team',
      scheduledAt: deal?.lead.preferredSurveySlot || '2026-05-24T10:00',
      location: deal?.lead.location ?? 'Site location pending',
      notes: 'Scheduled from stage gate quick action.',
    });
  }

  function completeSurvey(id: string, actorRole: Role): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    if (!deal.surveyJob) {
      mutateDeal(id, (currentDeal) => addEvent(currentDeal, actorRole, 'Blocked: survey must be assigned first.'));
      return failure('Survey must be assigned first.');
    }
    if (deal.surveyJob.completed) return failure('Survey is already complete.');
    const uploadGate = canCompleteInstallerSurvey(deal.surveyUploads, actorRole, deal.surveyJob.roofStructurallySound);
    if (!uploadGate.allowed) {
      mutateDeal(id, (currentDeal) => addEvent(currentDeal, actorRole, `Blocked: ${uploadGate.reason}`));
      return failure(uploadGate.reason);
    }
    const surveyed: Deal = {
      ...deal,
      surveyJob: {
        ...deal.surveyJob,
        installerValidationPayload: {
          ...buildInstallerValidationPayload(deal.surveyUploads, deal.surveyJob.roofStructurallySound),
          validatedAt: new Date().toLocaleString('en-PH'),
          validatedByRole: actorRole,
        },
        roofCondition: deal.surveyJob.roofStructurallySound === false ? 'Engineering review required' : 'Good condition',
        shading: 'Minimal shading',
        usableRoofArea: deal.surveyJob.usableRoofArea || '95 sqm',
        mapPin: deal.surveyJob.mapPin || deal.lead.location,
        siteAccessNotes: deal.surveyJob.siteAccessNotes || 'Access confirmed with site contact.',
        photoPlaceholders: ['Main Breaker Panel uploaded', 'Roof Surface uploaded', 'Inverter Location uploaded', 'Wire Run Path uploaded'],
        evidenceLockedAt: new Date().toLocaleString('en-PH'),
        completed: true,
      },
      surveyApproval: {
        id: deal.surveyApproval?.id ?? `approval-${deal.surveyJob.id}`,
        surveyJobId: deal.surveyJob.id,
        status: 'installer_validated',
        notes: 'Installer completed survey validation with required evidence uploaded.',
        updatedAt: new Date().toLocaleString('en-PH'),
      },
    };
    const synced = { ...surveyed, netMeteringWorkflow: syncNetMeteringWorkflow(surveyed) };
    const gate = canAdvanceStage(synced, 'survey_completed');
    const updated = updateDeal(
      synced,
      { stage: gate.allowed ? 'survey_completed' : deal.stage },
      actorRole,
      gate.allowed ? 'Installer validated survey evidence and technical review.' : `Blocked: ${gate.reason}`,
    );
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    setNotifications((current) => [
      buildNotification({
        title: 'Installer survey validated',
        body: `${deal.lead.businessName} survey is complete and ready for proposal gating.`,
        targetRole: 'sales',
        linkedRecordType: 'survey',
        linkedRecordId: id,
        severity: 'success',
      }),
      ...current,
    ]);
    return gate.allowed ? success('Survey completed.') : failure(gate.reason);
  }

  function addSurveyUpload(id: string, actorRole: Role, category: SurveyUploadCategory, fileName: string, previewUrl?: string) {
    mutateDeal(id, (deal) => {
      if (!deal.surveyJob) return addEvent(deal, actorRole, 'Blocked: survey must be assigned before evidence upload.');
      const upload = buildSurveyUpload({
        surveyJobId: deal.surveyJob.id,
        category,
        fileName,
        storagePath: `${deal.surveyJob.id}/${category}/${fileName}`,
        uploadedByRole: actorRole,
        previewUrl,
      });
      const surveyUploads = [upload, ...deal.surveyUploads];
      const vaultFile = buildDealFile({
        dealId: id,
        category: 'survey_evidence',
        fileName,
        mimeType: 'image/jpeg',
        uploadedByRole: actorRole,
        storagePath: upload.storagePath,
        source: 'installer_upload',
        linkedRecordType: 'survey',
        linkedRecordId: deal.surveyJob.id,
        previewUrl,
      });
      return updateDeal(
        deal,
        {
          surveyUploads,
          dealFiles: [vaultFile, ...(deal.dealFiles ?? [])],
          surveyJob: {
            ...deal.surveyJob,
            installerValidationPayload: buildInstallerValidationPayload(surveyUploads, deal.surveyJob.roofStructurallySound),
          },
          surveyApproval: {
            id: deal.surveyApproval?.id ?? `approval-${deal.surveyJob.id}`,
            surveyJobId: deal.surveyJob.id,
            status: 'pending_uploads',
            notes: 'Installer submitted survey evidence. Survey completion requires all required categories.',
            updatedAt: new Date().toLocaleString('en-PH'),
          },
        },
        actorRole,
        `Survey evidence uploaded: ${category.replaceAll('_', ' ')}.`,
      );
    });
    setNotifications((current) => [
      buildNotification({
        title: 'Survey upload received',
        body: `${category.replaceAll('_', ' ')} evidence was uploaded for installer survey completion.`,
        targetRole: 'installer',
        linkedRecordType: 'survey',
        linkedRecordId: id,
        severity: 'info',
      }),
      ...current,
    ]);
  }

  function updateSurveyRoofSoundness(id: string, actorRole: Role, roofStructurallySound: boolean): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal?.surveyJob) return failure('Survey must be assigned before roof soundness can be recorded.');
    if (actorRole !== 'installer') return failure('Only installers can record roof structural soundness.');
    const updated = updateDeal(
      deal,
      {
        surveyJob: {
          ...deal.surveyJob,
          roofStructurallySound,
          installerValidationPayload: buildInstallerValidationPayload(deal.surveyUploads, roofStructurallySound),
          roofCondition: roofStructurallySound ? 'Good condition' : 'Engineering review required',
        },
      },
      actorRole,
      `Roof structural soundness recorded as ${roofStructurallySound ? 'yes' : 'no'}.`,
    );
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    return success('Roof structural soundness saved.');
  }

  function generateProposal(id: string, actorRole: Role): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    if (deal.contract && deal.proposal) return failure('Contract and proposal are already generated.');
    if (deal.stage !== 'survey_completed' || !deal.preAudit) {
      mutateDeal(id, (currentDeal) => addEvent(currentDeal, actorRole, 'Blocked: survey completion is required before proposal.'));
      return failure('Survey completion is required before proposal.');
    }
    const netMeteringGate = evaluateNetMeteringGate(deal);
    if (!netMeteringGate.allowed) {
      mutateDeal(id, (currentDeal) => addEvent(currentDeal, actorRole, `Blocked: ${netMeteringGate.reason}`));
      return failure(netMeteringGate.reason);
    }
    if (!isInstallerSurveyValidated(deal)) {
      mutateDeal(id, (currentDeal) => addEvent(currentDeal, actorRole, 'Blocked: Installer must validate required survey evidence before proposal.'));
      return failure('Installer must validate required survey evidence before proposal.');
    }
    const preflight = evaluateCheckoutPreflight(deal);
    if (!preflight.canGenerateQuote) {
      mutateDeal(id, (currentDeal) => addEvent(currentDeal, actorRole, `Blocked: ${preflight.blockers.join('; ')}`));
      return failure(`Complete proposal preflight before contract: ${preflight.blockers.join('; ')}`);
    }
    if (!deal.checkoutEstimate) {
      mutateDeal(id, (currentDeal) => addEvent(currentDeal, actorRole, 'Blocked: formal proposal estimate must be built before contract generation.'));
      return failure('Formal proposal estimate must be built before contract generation.');
    }
    if (deal.checkoutEstimate.status !== 'frozen') {
      mutateDeal(id, (currentDeal) => addEvent(currentDeal, actorRole, 'Blocked: formal proposal estimate must be reviewed and frozen before contract generation.'));
      return failure('Freeze the formal proposal estimate before contract generation.');
    }
    if (deal.checkoutEstimate.approvalStatus === 'needs_pricing_approval') {
      mutateDeal(id, (currentDeal) => addEvent(currentDeal, actorRole, 'Blocked: pricing approval is required before contract generation.'));
      return failure('Pricing approval is required before contract generation.');
    }
    const checkoutEstimate = deal.checkoutEstimate;
    const mockCheckoutLink = `${contractOrigin()}/proposals/${deal.id}?mock_payment=${checkoutEstimate.id}`;
    const contract = createContractRecord(deal, checkoutEstimate, contractOrigin());
    const proposal = {
      id: `proposal-${deal.id}`,
      quoteNumber: `Q-${new Date().getFullYear()}-${deal.code.slice(-3)}`,
      systemSizeKwp: deal.preAudit.sizeKwp,
      projectPrice: checkoutEstimate.total,
      projectedSavings: deal.preAudit.projectedSavings,
      grossMarginPercent: checkoutEstimate.grossMarginPercent,
      frozenHtml: `<article><h1>${deal.lead.businessName} Solar Proposal</h1><p>${checkoutEstimate.total.toLocaleString('en-PH')} PHP package for ${deal.preAudit.sizeKwp} kWp. Projected savings: ${deal.preAudit.projectedSavings.toLocaleString('en-PH')} PHP/month.</p></article>`,
      mockCheckoutLink,
      status: 'ready' as const,
    };
    const updatedWithoutWorkflow = {
      ...deal,
      checkoutEstimate: { ...checkoutEstimate, status: 'contract_generated' as const },
      contract,
      proposal,
    };
    const updated = { ...updatedWithoutWorkflow, netMeteringWorkflow: syncNetMeteringWorkflow(updatedWithoutWorkflow) };
    const gate = canAdvanceStage(updated, 'proposal_ready');
    const finalDeal = updateDeal(updated, { stage: gate.allowed ? 'proposal_ready' : deal.stage }, actorRole, gate.allowed ? 'Formal proposal estimate, proposal, and public contract link generated.' : `Blocked: ${gate.reason}`);
    setDeals((current) => current.map((item) => (item.id === id ? finalDeal : item)));
    return gate.allowed ? success('Contract link generated.') : failure(gate.reason);
  }

  function buildCheckoutEstimate(
    id: string,
    actorRole: Role,
    paymentMethod?: PaymentMethod,
    billingAmountType?: BillingAmountType,
    customBillingAmount?: number,
  ): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    if (deal.stage !== 'survey_completed' || !deal.preAudit) {
      mutateDeal(id, (currentDeal) => addEvent(currentDeal, actorRole, 'Blocked: survey completion is required before proposal building.'));
      return failure('Survey completion is required before proposal building.');
    }
    const preflight = evaluateCheckoutPreflight(deal);
    if (!preflight.canGenerateQuote) {
      mutateDeal(id, (currentDeal) => addEvent(currentDeal, actorRole, `Blocked: ${preflight.blockers.join('; ')}`));
      return failure(`Complete proposal preflight before estimate: ${preflight.blockers.join('; ')}`);
    }
    const estimate = createQuoteDraft(deal, { paymentMethod, billingAmountType, customBillingAmount });
    const updated = updateDeal(deal, { checkoutEstimate: estimate }, actorRole, 'Formal quote draft created from Solar API, pre-audit, and scope catalog.');
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    return success('Quote draft created.', estimate);
  }

  function updateCheckoutBilling(
    id: string,
    actorRole: Role,
    paymentMethod: PaymentMethod,
    billingAmountType: BillingAmountType,
    customBillingAmount?: number,
  ): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    if (!deal.checkoutEstimate && (deal.stage !== 'survey_completed' || !deal.preAudit)) {
      mutateDeal(id, (currentDeal) => addEvent(currentDeal, actorRole, 'Blocked: survey completion is required before proposal building.'));
      return failure('Survey completion is required before proposal building.');
    }
    if (!deal.checkoutEstimate) {
      const preflight = evaluateCheckoutPreflight(deal);
      if (!preflight.canGenerateQuote) {
        mutateDeal(id, (currentDeal) => addEvent(currentDeal, actorRole, `Blocked: ${preflight.blockers.join('; ')}`));
        return failure(`Complete proposal preflight before estimate: ${preflight.blockers.join('; ')}`);
      }
    }
    const estimate = deal.checkoutEstimate ?? (deal.preAudit ? createCheckoutEstimate(deal) : undefined);
    if (!estimate) {
      mutateDeal(id, (currentDeal) => addEvent(currentDeal, actorRole, 'Blocked: proposal estimate requires pre-audit and survey completion.'));
      return failure('Proposal estimate requires pre-audit and survey completion.');
    }
    const updatedEstimate = updateEstimateBilling(estimate, paymentMethod, billingAmountType, customBillingAmount);
    const updated = updateDeal(
      deal,
      { checkoutEstimate: updatedEstimate },
      actorRole,
      'Proposal payment method and billing amount updated.',
    );
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    return success('Proposal payment terms saved.', updatedEstimate);
  }

  function updateCheckoutLine(id: string, lineId: string, actorRole: Role, patch: Partial<Pick<EstimateLineItem, 'name' | 'description' | 'quantity' | 'unit' | 'unitPrice' | 'estimatedCost' | 'notes' | 'optional'>>): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal?.checkoutEstimate) return failure('Create a quote draft first.');
    if (!['sales', 'owner', 'manager'].includes(actorRole)) return failure('Only sales, owner, or manager can edit quote lines.');
    const estimate = updateQuoteLine(deal.checkoutEstimate, lineId, patch);
    const updated = updateDeal(deal, { checkoutEstimate: estimate }, actorRole, 'Quote line edited and margin recalculated.');
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    return success('Quote line updated.', estimate);
  }

  function addCheckoutLine(id: string, actorRole: Role): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal?.checkoutEstimate) return failure('Create a quote draft first.');
    if (!['sales', 'owner', 'manager'].includes(actorRole)) return failure('Only sales, owner, or manager can add quote lines.');
    const estimate = addQuoteLine(deal.checkoutEstimate, {
      category: 'adder',
      name: 'Custom scope adder',
      description: 'Manual customer-specific scope item.',
      quantity: 1,
      unit: 'lot',
      unitPrice: 0,
      estimatedCost: 0,
      sourceReason: 'Manual scope line added by sales.',
      notes: '',
      optional: true,
    });
    const updated = updateDeal(deal, { checkoutEstimate: estimate }, actorRole, 'Custom quote line added.');
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    return success('Quote line added.', estimate);
  }

  function removeCheckoutLine(id: string, lineId: string, actorRole: Role): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal?.checkoutEstimate) return failure('Create a quote draft first.');
    if (!['sales', 'owner', 'manager'].includes(actorRole)) return failure('Only sales, owner, or manager can remove quote lines.');
    const estimate = removeQuoteLine(deal.checkoutEstimate, lineId);
    const updated = updateDeal(deal, { checkoutEstimate: estimate }, actorRole, 'Quote line removed.');
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    return success('Quote line removed.', estimate);
  }

  function approveCheckoutPricing(id: string, actorRole: Role, note = 'Pricing approved for formal quote.'): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal?.checkoutEstimate) return failure('Create a quote draft first.');
    try {
      const estimate = approveQuotePricing(deal.checkoutEstimate, actorRole, note);
      const updated = updateDeal(deal, { checkoutEstimate: estimate }, actorRole, `Pricing approval logged: ${note}`);
      setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
      return success('Pricing approved.', estimate);
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Unable to approve pricing.');
    }
  }

  function freezeEstimate(id: string, actorRole: Role): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal?.checkoutEstimate) return failure('Create a quote draft first.');
    try {
      const estimate = freezeCheckoutEstimate(deal.checkoutEstimate, actorRole);
    const updated = updateDeal(deal, { checkoutEstimate: estimate }, actorRole, 'Formal proposal estimate frozen for contract.');
      setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
      return success('Estimate frozen.', estimate);
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Unable to freeze estimate.');
    }
  }

  function requestQuote(id: string, actorRole: Role, note = 'Customer requested a formal solar quote.'): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    const result = createQuoteRequest(deal, actorRole, note);
    if (!result.ok || !result.data) return result;
    const updated = updateDeal(
      deal,
      { quoteRequests: [result.data, ...deal.quoteRequests] },
      actorRole,
      `Quote request created: ${result.data.note}`,
    );
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    setNotifications((current) => [
      buildNotification({
        title: 'Quote request created',
        body: `${deal.lead.businessName} needs quote review before proposal conversion.`,
        targetRole: 'sales',
        linkedRecordType: 'lead',
        linkedRecordId: id,
        severity: 'info',
      }),
      ...current,
    ]);
    return result;
  }

  function setQuoteRequestStatus(
    id: string,
    quoteRequestId: string,
    actorRole: Role,
    status: 'approved' | 'rejected' | 'cancelled',
    reason = '',
  ): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    const quoteRequest = deal.quoteRequests.find((request) => request.id === quoteRequestId);
    if (!quoteRequest) return failure('Quote request not found.');
    const result = status === 'approved'
      ? approveQuoteRequest(quoteRequest, actorRole)
      : status === 'rejected'
        ? rejectQuoteRequest(quoteRequest, actorRole, reason || 'Quote request rejected.')
        : cancelQuoteRequest(quoteRequest, actorRole, reason || 'Quote request cancelled.');
    if (!result.ok || !result.data) return result;
    const updated = updateDeal(
      deal,
      { quoteRequests: deal.quoteRequests.map((request) => (request.id === quoteRequestId ? result.data! : request)) },
      actorRole,
      `Quote request ${status.replaceAll('_', ' ')}.`,
    );
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    setNotifications((current) => [
      buildNotification({
        title: `Quote request ${status.replaceAll('_', ' ')}`,
        body: `${deal.lead.businessName} quote request was ${status.replaceAll('_', ' ')}.`,
        targetRole: 'sales',
        linkedRecordType: 'lead',
        linkedRecordId: id,
        severity: status === 'approved' ? 'success' : 'warning',
      }),
      ...current,
    ]);
    return result;
  }

  function convertQuoteToCheckout(id: string, quoteRequestId: string, actorRole: Role): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    const quoteRequest = deal.quoteRequests.find((request) => request.id === quoteRequestId);
    if (!quoteRequest) return failure('Quote request not found.');
    const result = convertQuoteRequestToCheckout(deal, quoteRequest, actorRole);
    if (!result.ok || !result.data) return result;
    const updated = updateDeal(
      deal,
      {
        checkoutEstimate: result.data.estimate,
        quoteRequests: deal.quoteRequests.map((request) => (request.id === quoteRequestId ? result.data!.quoteRequest : request)),
      },
      actorRole,
      'Approved quote request converted into proposal estimate.',
    );
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    setNotifications((current) => [
      buildNotification({
        title: 'Quote converted to proposal',
        body: `${deal.lead.businessName} now has a formal proposal estimate ready for contract generation.`,
        targetRole: 'cs',
        linkedRecordType: 'lead',
        linkedRecordId: id,
        severity: 'success',
      }),
      ...current,
    ]);
    return success('Quote request converted to proposal estimate.');
  }

  function updateNetMeteringStep(id: string, actorRole: Role, stepId: NetMeteringStepId, status: NetMeteringStepStatus): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    const workflow = syncNetMeteringWorkflow(deal);
    const updatedWorkflow = {
      ...workflow,
      steps: workflow.steps.map((step) => (
        step.id === stepId
          ? { ...step, status, missingItems: status === 'complete' ? [] : step.missingItems, updatedAt: new Date().toLocaleString('en-PH') }
          : step
      )),
    };
    const updated = updateDeal(deal, { netMeteringWorkflow: updatedWorkflow }, actorRole, `Net-metering ${stepId.replaceAll('_', ' ')} marked ${status.replaceAll('_', ' ')}.`);
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    setNotifications((current) => [
      buildNotification({
        title: 'Net-metering status changed',
        body: `${deal.lead.businessName}: ${stepId.replaceAll('_', ' ')} is now ${status.replaceAll('_', ' ')}.`,
        targetRole: stepId === 'technical_review' ? 'installer' : 'cs',
        linkedRecordType: 'lead',
        linkedRecordId: id,
        severity: status === 'complete' ? 'success' : 'info',
      }),
      ...current,
    ]);
    return success('Net-metering workflow updated.');
  }

  function generateComplianceDocs(id: string, actorRole: Role, signerName = 'Authorized customer signatory'): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    if (!['cs', 'owner'].includes(actorRole)) return failure('Only CS or owner can generate compliance documents.');
    if (!deal.readinessIntake?.location && !deal.lead.location) return failure('Customer address is required for compliance documents.');
    const systemSize = deal.preAudit?.sizeKwp ?? deal.readinessResult?.recommendedSystemSizeKwp;
    if (!systemSize) return failure('System size is required for compliance documents.');
    try {
      const documents = createComplianceDocuments({ deal, actorRole, signerName, rule: deal.complianceRule ?? defaultComplianceRule });
      const generatedFiles = documents.map((document) => buildDealFile({
        dealId: id,
        category: 'generated_compliance_pdf',
        fileName: `${document.documentType}-${document.ruleVersion}.pdf`,
        mimeType: 'application/pdf',
        uploadedByRole: 'system',
        storagePath: document.storagePath,
        source: 'system_generated',
        linkedRecordType: 'document',
        linkedRecordId: document.id,
      })).map((file) => ({ ...file, validationStatus: 'validated' as const, validatedByRole: actorRole, validatedAt: new Date().toLocaleString('en-PH') }));
      const workflow = syncNetMeteringWorkflow(deal);
      const updatedWorkflow = {
        ...workflow,
        status: 'compliance_docs_generated' as const,
      };
      const updated = updateDeal(
        deal,
        {
          complianceRule: deal.complianceRule ?? defaultComplianceRule,
          complianceDocuments: documents,
          dealFiles: [...generatedFiles, ...(deal.dealFiles ?? [])],
          netMeteringWorkflow: updatedWorkflow,
          automationEvents: [
            {
              id: eventId(),
              eventType: 'compliance_documents_generated',
              linkedRecordType: 'lead',
              linkedRecordId: id,
              payload: { documents: documents.length, ruleVersion: documents[0]?.ruleVersion ?? defaultComplianceRule.version },
              status: 'logged',
              createdAt: new Date().toLocaleString('en-PH'),
            },
            ...(deal.automationEvents ?? []),
          ],
        },
        actorRole,
        'Net-metering Annex compliance PDFs generated.',
      );
      setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
      return success('Compliance documents generated.', documents);
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Compliance document generation failed.');
    }
  }

  function markNetMeteringReadyForLender(id: string, actorRole: Role, reason = 'Owner reviewed compliance packet and marked lender-ready.'): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    if (actorRole !== 'owner') return failure('Only owner can mark net-metering ready for lender.');
    const documentGate = hasRequiredComplianceDocuments(deal.complianceDocuments);
    if (!documentGate.allowed) return failure(`Generate required compliance PDFs first: ${documentGate.missing.join(', ')}.`);
    const workflow = syncNetMeteringWorkflow(deal);
    try {
      const updatedWorkflow = markWorkflowReadyForLender(workflow, actorRole, reason);
      const updated = updateDeal(
        deal,
        {
          netMeteringWorkflow: updatedWorkflow,
          automationEvents: [
            {
              id: eventId(),
              eventType: 'compliance_ready_for_lender',
              linkedRecordType: 'lead',
              linkedRecordId: id,
              payload: { reason },
              status: 'logged',
              createdAt: new Date().toLocaleString('en-PH'),
            },
            ...(deal.automationEvents ?? []),
          ],
        },
        actorRole,
        'Owner marked net-metering workflow ready for lender.',
      );
      setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
      return success('Net-metering marked ready for lender.', updatedWorkflow);
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Unable to mark ready for lender.');
    }
  }

  function ownerOverrideSolarApi(id: string, actorRole: Role, reason = 'Owner accepted manual Solar API review for formal quote.'): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    if (actorRole !== 'owner') return failure('Only owner can override Solar API verification.');
    const now = new Date().toLocaleString('en-PH');
    const solarInsights = deal.solarInsights ?? buildMapsPendingSnapshot(deal, 'Solar API pending until owner override.').solarInsights;
    const updated = updateDeal(
      deal,
      {
        solarInsights: {
          ...solarInsights,
          ownerOverrideAt: now,
          ownerOverrideReason: reason,
          riskFlags: Array.from(new Set([...solarInsights.riskFlags, reason])),
        },
      },
      actorRole,
      `Owner override applied to Solar API gate: ${reason}`,
    );
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    return success('Solar API owner override recorded.', updated.solarInsights);
  }

  function acceptContract(token: string, signerName: string): ActionResult {
    const cleanName = signerName.trim();
    if (!cleanName) return failure('Typed signer name is required.');
    const deal = deals.find((item) => item.contract?.token === token);
    if (!deal || !deal.checkoutEstimate || !deal.contract) return failure('Contract link is no longer available.');
    if (deal.contract.status === 'signed') return failure('Contract is already signed.');

    const acceptedAt = new Date().toLocaleString('en-PH');
    const acceptance = {
      id: `acceptance-${deal.contract.id}`,
      signerName: cleanName,
      acceptedAt,
      token,
      contractVersion: deal.contract.version,
      paymentMethod: deal.checkoutEstimate.paymentMethod,
      acceptedAmount: deal.checkoutEstimate.billingAmount,
    };
    const contract = {
      ...deal.contract,
      status: 'signed' as const,
      signedAt: acceptedAt,
      acceptance,
    };
    const checkoutEstimate = { ...deal.checkoutEstimate, status: 'accepted' as const };
    const proposal = deal.proposal ? { ...deal.proposal, status: 'accepted' as const } : deal.proposal;
    const invoice = createAcceptedInvoice(deal, contract, checkoutEstimate);
    const billingTransaction = createMockBillingTransaction(invoice, contract, checkoutEstimate);
    const updated = addEvent(
      {
        ...deal,
        checkoutEstimate,
        contract,
        proposal,
        invoice,
        billingTransaction,
        billingLedger: [
          buildBillingLedgerEvent({ linkedRecordId: deal.id, eventType: 'invoice_created', amount: invoice.amount, actorRole: 'cs', note: 'Invoice generated from typed contract acceptance.' }),
          buildBillingLedgerEvent({ linkedRecordId: deal.id, eventType: 'mock_payment_attempt', amount: billingTransaction.amount, actorRole: 'cs', note: 'Mock provider billing attempt generated from signed contract.' }),
          ...deal.billingLedger,
        ],
      },
      'sales',
      'Client typed acceptance captured; invoice and mocked billing transaction generated.',
    );
    setDeals((current) => current.map((item) => (item.id === deal.id ? updated : item)));
    setClients((current) => {
      const existing = current.find((client) => client.linkedDealId === deal.id);
      const clientPatch = {
        businessName: deal.lead.businessName,
        contactName: deal.lead.contactName,
        location: deal.lead.location,
        status: 'active_client' as const,
        linkedDealId: deal.id,
        commercialValue: checkoutEstimate.total,
        nextAction: 'CS to complete post-signature document and payment readiness.',
        archiveState: 'active' as const,
      };
      return existing
        ? current.map((client) => (client.id === existing.id ? { ...client, ...clientPatch } : client))
        : [{ id: `client-${deal.id}`, ...clientPatch }, ...current];
    });
    setNotifications((current) => [
      buildNotification({
        title: 'Contract signed',
        body: `${deal.lead.businessName} signed. Invoice and mocked billing attempt were created.`,
        targetRole: 'cs',
        linkedRecordType: 'billing',
        linkedRecordId: deal.id,
        severity: 'success',
      }),
      ...current,
    ]);
    return success('Contract signed; invoice and mocked billing transaction generated.');
  }

  function findContractByToken(token: string) {
    return deals.find((deal) => deal.contract?.token === token);
  }

  function generateDealRoom(id: string, actorRole: Role): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    if (!['sales', 'owner'].includes(actorRole)) return failure('Only sales or owner can generate Client Portal links.');
    const room = createDealRoom(deal, contractOrigin());
    const updated = updateDeal(
      deal,
      {
        dealRoom: room,
        automationEvents: [
          {
            id: eventId(),
            eventType: 'deal_room_viewed',
            linkedRecordType: 'lead',
            linkedRecordId: id,
            payload: { token: room.token, created: true },
            status: 'logged',
            createdAt: new Date().toLocaleString('en-PH'),
          },
          ...(deal.automationEvents ?? []),
        ],
      },
      actorRole,
      'Client Portal link generated.',
    );
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    return success('Client Portal link generated.', room);
  }

  function findDealRoomByToken(token: string) {
    return deals.find((deal) => deal.dealRoom?.token === token);
  }

  function recordDealRoomView(token: string): ActionResult {
    const deal = findDealRoomByToken(token);
    if (!deal?.dealRoom) return failure('Client Portal is not available.');
    const room = recordDealRoomEvent(deal.dealRoom, 'viewed');
    setDeals((current) => current.map((item) => (item.id === deal.id ? { ...deal, dealRoom: room } : item)));
    return success('Client Portal view recorded.', room);
  }

  function requestDealRoomFormalQuote(token: string, input: DealRoomQuoteRequestInput): ActionResult {
    const deal = findDealRoomByToken(token);
    if (!deal?.dealRoom) return failure('Client Portal is not available.');
    const room = requestDealRoomQuote(deal.dealRoom, input);
    setDeals((current) => current.map((item) => (item.id === deal.id ? {
      ...deal,
      dealRoom: room,
      automationEvents: [
        {
          id: eventId(),
          eventType: 'deal_room_quote_requested',
          linkedRecordType: 'lead',
          linkedRecordId: deal.id,
          payload: { token, contactName: input.contactName, phone: input.phone },
          status: 'ready_for_external_sync',
          createdAt: new Date().toLocaleString('en-PH'),
        },
        ...(deal.automationEvents ?? []),
      ],
    } : item)));
    setNotifications((current) => [
      buildNotification({
        title: 'Formal quote requested',
        body: `${deal.lead.businessName} requested a formal quote from the Client Portal.`,
        targetRole: 'sales',
        linkedRecordType: 'lead',
        linkedRecordId: deal.id,
        severity: 'success',
      }),
      ...current,
    ]);
    return success('Formal quote requested.', room);
  }

  function generateRemoteIntakeLink(id: string, actorRole: Role): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    if (!['owner', 'sales', 'cs'].includes(actorRole)) return failure('Only staff can generate remote intake links.');
    const link = deal.remoteIntakeLink ?? createRemoteIntakeLink(deal, contractOrigin());
    const updated = updateDeal(
      deal,
      {
        remoteIntakeLink: link,
        automationEvents: [
          {
            id: eventId(),
            eventType: 'remote_intake_generated',
            linkedRecordType: 'lead',
            linkedRecordId: id,
            payload: { token: link.token, expiresAt: link.expiresAt },
            status: 'logged',
            createdAt: new Date().toLocaleString('en-PH'),
          },
          ...(deal.automationEvents ?? []),
        ],
      },
      actorRole,
      'Remote client intake magic link generated.',
    );
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    return success('Remote intake link generated.', link);
  }

  function markRemoteIntakeSent(id: string, actorRole: Role): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal?.remoteIntakeLink) return failure('Generate a remote intake link first.');
    const link = markRemoteIntakeSentRecord(deal.remoteIntakeLink, actorRole);
    const updated = updateDeal(deal, { remoteIntakeLink: link }, actorRole, 'Remote intake link marked as manually sent.');
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    return success('Remote intake marked sent.', link);
  }

  function findRemoteIntakeByToken(token: string) {
    return deals.find((deal) => deal.remoteIntakeLink?.token === token);
  }

  function recordRemoteIntakeUpload(token: string, category: RemoteIntakeUploadCategory, fileName: string): ActionResult {
    const deal = findRemoteIntakeByToken(token);
    if (!deal?.remoteIntakeLink) return failure('Remote intake link is not available.');
    const { link } = recordRemoteIntakeUploadRecord(deal.remoteIntakeLink, category, fileName, 'remote-client');
    const nextReadiness = deal.readinessIntake
      ? {
        ...deal.readinessIntake,
        billUploadFileName: category === 'customer_bill' ? fileName : deal.readinessIntake.billUploadFileName,
      }
      : deal.readinessIntake;
    const readinessUploads = category === 'customer_bill'
      ? [
        {
          id: `readiness-${category}-${Date.now()}`,
          leadId: deal.id,
          category: 'bill' as const,
          fileName,
          storagePath: `${deal.id}/remote-intake/${category}/${fileName}`,
          uploadedAt: new Date().toLocaleString('en-PH'),
        },
        ...deal.readinessUploads.filter((upload) => upload.category !== 'bill'),
      ]
      : deal.readinessUploads;
    const vaultCategory = category === 'customer_bill'
      ? 'customer_bill'
      : category === 'valid_id'
        ? 'valid_id'
        : 'site_control_document';
    const dealFile = buildDealFile({
      dealId: deal.id,
      category: vaultCategory,
      fileName,
      mimeType: fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      uploadedByRole: 'remote-client',
      storagePath: `${deal.id}/remote-intake/${category}/${fileName}`,
      source: 'remote_intake',
    });
    const patchedDeal: Deal = {
      ...deal,
      remoteIntakeLink: link,
      readinessIntake: nextReadiness,
      readinessUploads,
      dealFiles: [dealFile, ...(deal.dealFiles ?? [])],
      automationEvents: [
        {
          id: eventId(),
          eventType: 'remote_intake_uploaded',
          linkedRecordType: 'lead',
          linkedRecordId: deal.id,
          payload: { token, category, fileName, complete: link.status === 'completed' },
          status: 'logged',
          createdAt: new Date().toLocaleString('en-PH'),
        },
        ...(deal.automationEvents ?? []),
      ],
    };
    const synced = updateDeal(
      { ...patchedDeal, netMeteringWorkflow: syncNetMeteringWorkflow(patchedDeal) },
      {},
      'sales',
      `Remote client upload received: ${category.replaceAll('_', ' ')}.`,
    );
    setDeals((current) => current.map((item) => (item.id === deal.id ? synced : item)));
    setNotifications((current) => [
      buildNotification({
        title: link.status === 'completed' ? 'Remote intake complete' : 'Remote intake upload received',
        body: `${deal.lead.businessName} uploaded ${category.replaceAll('_', ' ')} from the magic link.`,
        targetRole: link.status === 'completed' ? 'cs' : 'sales',
        linkedRecordType: 'lead',
        linkedRecordId: deal.id,
        severity: link.status === 'completed' ? 'success' : 'info',
      }),
      ...current,
    ]);
    return success('Remote intake upload recorded.', link);
  }

  function uploadDealFile(id: string, actorRole: Role, category: DealFileCategory, fileName: string, mimeType = 'application/octet-stream', previewUrl?: string): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    const file = buildDealFile({
      dealId: id,
      category,
      fileName,
      mimeType,
      uploadedByRole: actorRole,
      previewUrl,
    });
    const updated = updateDeal(deal, { dealFiles: [file, ...(deal.dealFiles ?? [])] }, actorRole, `${category.replaceAll('_', ' ')} uploaded to deal file vault.`);
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    return success('File uploaded to vault and waiting for validation.', file);
  }

  function validateFile(id: string, fileId: string, actorRole: Role): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    const file = deal.dealFiles?.find((item) => item.id === fileId);
    if (!file) return failure('File not found.');
    try {
      const validated = validateDealFile(file, actorRole);
      const documents = {
        ...deal.documents,
        electricBills: validated.category === 'customer_bill' ? true : deal.documents.electricBills,
        validId: validated.category === 'valid_id' ? true : deal.documents.validId,
        locationPin: validated.category === 'site_control_document' ? true : deal.documents.locationPin,
        roofAccess: validated.category === 'site_control_document' ? true : deal.documents.roofAccess,
      };
      const patchedDeal = {
        ...deal,
        documents,
        dealFiles: (deal.dealFiles ?? []).map((item) => (item.id === fileId ? validated : item)),
      };
      const updated = updateDeal(
        { ...patchedDeal, netMeteringWorkflow: syncNetMeteringWorkflow(patchedDeal) },
        {},
        actorRole,
        `${validated.category.replaceAll('_', ' ')} validated in file vault.`,
      );
      setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
      return success('File validated and blockers refreshed.', validated);
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Unable to validate file.');
    }
  }

  function rejectFile(id: string, fileId: string, actorRole: Role, reason = 'File does not satisfy the requirement.'): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    const file = deal.dealFiles?.find((item) => item.id === fileId);
    if (!file) return failure('File not found.');
    try {
      const rejected = rejectDealFile(file, actorRole, reason);
      const updated = updateDeal(
        deal,
        { dealFiles: (deal.dealFiles ?? []).map((item) => (item.id === fileId ? rejected : item)) },
        actorRole,
        `${rejected.category.replaceAll('_', ' ')} rejected in file vault.`,
      );
      setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
      return success('File rejected.', rejected);
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Unable to reject file.');
    }
  }

  function createDealFileSignedDownloadUrl(id: string, fileId: string): ActionResult {
    const deal = deals.find((item) => item.id === id);
    const file = deal?.dealFiles?.find((item) => item.id === fileId);
    if (!file) return failure('File not found.');
    return success('Signed download URL created.', createSignedDownloadUrl(file));
  }

  function generateContractLink(id: string, actorRole: Role) {
    return generateProposal(id, actorRole);
  }

  function submitCsReview(id: string, actorRole: Role) {
    mutateDeal(id, (deal) => {
      if (deal.stage === 'proposal_ready') {
        const csGate = canAdvanceStage(deal, 'cs_review');
        if (!csGate.allowed) return addEvent(deal, actorRole, `Blocked: ${csGate.reason}`);
        const csDeal = updateDeal(
          deal,
          {
            stage: 'cs_review',
            documents: { electricBills: true, businessRegistration: true, validId: true, locationPin: true, roofAccess: true },
            csReady: true,
            invoice: deal.invoice ? { ...deal.invoice, paymentStatus: 'deposit_pending' } : deal.invoice,
          },
          actorRole,
          'CS completed docs/payment readiness review.',
        );
        const ownerGate = canAdvanceStage(csDeal, 'owner_review');
        return ownerGate.allowed ? updateDeal(csDeal, { stage: 'owner_review' }, actorRole, 'CS submitted deal to owner review.') : csDeal;
      }
      const gate = canAdvanceStage(deal, 'owner_review');
      return gate.allowed ? updateDeal(deal, { stage: 'owner_review' }, actorRole, 'CS submitted deal to owner review.') : addEvent(deal, actorRole, `Blocked: ${gate.reason}`);
    });
  }

  function approveOwnerReview(id: string, actorRole: Role, decision: 'approved' | 'changes_requested' | 'rejected' = 'approved') {
    mutateDeal(id, (deal) => {
      const gate = canAdvanceStage(deal, 'approved');
      if (!gate.allowed) return addEvent(deal, actorRole, `Blocked: ${gate.reason}`);
      return updateDeal(
        deal,
          {
            stage: decision === 'approved' ? 'approved' : 'owner_review',
            opportunityStatus: decision === 'approved' ? 'won' : decision === 'rejected' ? 'lost' : deal.opportunityStatus,
            ownerReview: {
              id: `owner-${deal.id}`,
            decision,
            marginApproved: decision === 'approved',
            notes: decision === 'approved' ? 'Approved for install-ready handoff.' : 'Owner requested changes before install-ready handoff.',
          },
        },
        actorRole,
        decision === 'approved' ? 'Owner approved the deal.' : 'Owner requested changes.',
      );
    });
  }

  function updateOpportunity(id: string, actorRole: Role, status: Deal['opportunityStatus']) {
    const gate = canSetOpportunityStatus(actorRole, status);
    if (!gate.allowed) return failure(gate.reason);
    mutateDeal(id, (deal) => updateDeal(deal, { opportunityStatus: status }, actorRole, `Deal status updated to ${status}.`));
    return success(`Deal marked ${status.replaceAll('_', ' ')}.`);
  }

  function archiveOpportunity(id: string, actorRole: Role) {
    archiveLead(id, actorRole);
  }

  function requestCancellation(id: string, actorRole: Role, reason = 'Customer requested cancellation review.') {
    mutateDeal(id, (deal) =>
      updateDeal(
        deal,
        {
          opportunityStatus: 'cancelled',
          cancellation: {
            id: `cancel-${deal.id}`,
            reason,
            status: 'requested',
            requestedBy: actorRole,
            requestedAt: new Date().toLocaleString('en-PH'),
            notes: 'Cancellation request logged. Financial records remain intact.',
          },
        },
        actorRole,
        `Cancellation requested: ${reason}`,
      ),
    );
  }

  function requestRefund(id: string, actorRole: Role, amount: number, reason = 'Client requested refund review.') {
    mutateDeal(id, (deal) =>
      updateDeal(
        deal,
        {
          refund: {
            id: `refund-${deal.id}`,
            amount: Math.max(0, Math.round(amount)),
            status: 'requested',
            reason,
            requestedBy: actorRole,
            requestedAt: new Date().toLocaleString('en-PH'),
            notes: 'Refund request logged for owner approval. No real money movement occurs in v1.',
          },
          billingLedger: [
            buildBillingLedgerEvent({ linkedRecordId: deal.id, eventType: 'refund_requested', amount, actorRole, note: reason }),
            ...deal.billingLedger,
          ],
        },
        actorRole,
        `Refund requested: ${reason}`,
      ),
    );
    setNotifications((current) => [
      buildNotification({
        title: 'Refund approval needed',
        body: `${reason} Requested amount: ${Math.max(0, Math.round(amount)).toLocaleString('en-PH')}.`,
        targetRole: 'owner',
        linkedRecordType: 'billing',
        linkedRecordId: id,
        severity: 'warning',
      }),
      ...current,
    ]);
  }

  function setRefundStatus(id: string, actorRole: Role, status: RefundStatus) {
    mutateDeal(id, (deal) => {
      if (!deal.refund) return addEvent(deal, actorRole, 'Blocked: refund must be requested first.');
      const gate = canSetRefundStatus(deal.refund, actorRole, status);
      if (!gate.allowed) return addEvent(deal, actorRole, `Blocked: ${gate.reason}`);
      return updateDeal(
        deal,
        {
          refund: {
            ...deal.refund,
            status,
            ownerDecisionBy: status === 'owner_approved' || status === 'rejected' ? actorRole : deal.refund.ownerDecisionBy,
            ownerDecisionAt: status === 'owner_approved' || status === 'rejected' ? new Date().toLocaleString('en-PH') : deal.refund.ownerDecisionAt,
          },
          billingLedger: [
            buildBillingLedgerEvent({ linkedRecordId: deal.id, eventType: 'refund_status_updated', amount: deal.refund.amount, actorRole, note: `Refund status updated to ${status.replaceAll('_', ' ')}.` }),
            ...deal.billingLedger,
          ],
        },
        actorRole,
        `Refund status updated to ${status.replaceAll('_', ' ')}.`,
      );
    });
  }

  function approveRefund(id: string, actorRole: Role) {
    setRefundStatus(id, actorRole, 'owner_approved');
  }

  function rejectRefund(id: string, actorRole: Role) {
    setRefundStatus(id, actorRole, 'rejected');
  }

  function markRefundProcessing(id: string, actorRole: Role) {
    setRefundStatus(id, actorRole, 'processing');
  }

  function completeRefund(id: string, actorRole: Role) {
    setRefundStatus(id, actorRole, 'completed');
  }

  function approveAiSuggestion(dealId: string, suggestionId: string, actorRole: Role) {
    mutateDeal(dealId, (deal) =>
      addEvent(
        {
          ...deal,
          aiSuggestions: deal.aiSuggestions.map((suggestion) => (suggestion.id === suggestionId ? { ...suggestion, approved: true } : suggestion)),
        },
        actorRole,
        'AI assist suggestion approved by staff.',
      ),
    );
  }

  function createTicket(input: {
    linkedRecordType: LinkedRecordType;
    linkedRecordId: string;
    category: TicketCategory;
    priority: TicketPriority;
    title: string;
    ownerRole: Role;
    assigneeName?: string;
    dueAt?: string;
  }) {
    const ticket = buildTicket(input);
    setTickets((current) => [ticket, ...current]);
    setNotifications((current) => [
      buildNotification({
        title: 'Ticket created',
        body: ticket.title,
        targetRole: ticket.ownerRole,
        linkedRecordType: 'ticket',
        linkedRecordId: ticket.id,
        severity: ticket.priority === 'urgent' || ticket.priority === 'high' ? 'warning' : 'info',
      }),
      ...current,
    ]);
    return ticket.id;
  }

  function createCalendarEvent(input: Parameters<typeof buildCalendarEvent>[0]) {
    const event = buildCalendarEvent(input);
    setCalendarEvents((current) => [event, ...current]);
    return event.id;
  }

  function scheduleInstallation(id: string, actorRole: Role, input: { assignedInstaller: string; scheduledAt: string; location: string; notes?: string }): ActionResult {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return failure('Lead not found.');
    if (!['owner', 'manager', 'sales', 'cs'].includes(actorRole)) return failure('Only staff can schedule installation work.');
    if (!input.assignedInstaller.trim()) return failure('Assigned installer is required.');
    if (!input.scheduledAt.trim()) return failure('Installation calendar slot is required.');
    if (!input.location.trim()) return failure('Installation location is required.');
    const event = buildCalendarEvent({
      title: `Installation: ${deal.lead.businessName}`,
      linkedRecordType: 'lead',
      linkedRecordId: id,
      startAt: input.scheduledAt,
      endAt: new Date(new Date(input.scheduledAt).getTime() + 8 * 60 * 60 * 1000).toISOString(),
      ownerRole: actorRole,
      type: 'installation',
      location: input.location,
      notes: input.notes ?? 'Installation job scheduled from operations workspace.',
    });
    const installationJob = {
      id: `install-${id}`,
      dealId: id,
      assignedInstaller: input.assignedInstaller.trim(),
      scheduledAt: input.scheduledAt,
      location: input.location,
      status: 'scheduled' as const,
      calendarEventId: event.id,
    };
    const updated = updateDeal(deal, { installationJob }, actorRole, 'Installation job scheduled.');
    setDeals((current) => current.map((item) => (item.id === id ? updated : item)));
    setCalendarEvents((current) => [event, ...current]);
    return success('Installation scheduled.', installationJob);
  }

  function createBillingLedgerEvent(id: string, actorRole: Role, eventType: BillingLedgerEventType, amount: number, note: string) {
    mutateDeal(id, (deal) =>
      updateDeal(
        deal,
        { billingLedger: [buildBillingLedgerEvent({ linkedRecordId: id, eventType, amount, actorRole, note }), ...deal.billingLedger] },
        actorRole,
        `Billing ledger event recorded: ${eventType.replaceAll('_', ' ')}.`,
      ),
    );
  }

  function createReportSnapshot(actorRole: Role) {
    const snapshot = buildReportSnapshot(deals, actorRole);
    buildReportEmbeddingChunk(snapshot, new Array(1536).fill(0.01));
    setReportSnapshots((current) => [snapshot, ...current]);
    return snapshot.id;
  }

  function updateStaffProfile(id: string, input: Partial<StaffProfile>) {
    setStaff((current) => current.map((profile) => (profile.id === id ? applySelfProfileUpdate(profile, input) : profile)));
  }

  function upsertStaffProfile(profile: StaffProfile) {
    setStaff((current) => {
      const existing = current.find((item) => item.id === profile.id);
      return existing ? current.map((item) => (item.id === profile.id ? { ...item, ...profile } : item)) : [profile, ...current];
    });
  }

  function markNotificationRead(id: string) {
    setNotifications((current) => current.map((notification) => (
      notification.id === id ? { ...notification, readAt: notification.readAt ?? new Date().toLocaleString('en-PH') } : notification
    )));
  }

  function markAllNotificationsRead(role: Role, profileId?: string) {
    setNotifications((current) => current.map((notification) => (
      (!notification.readAt && (notification.targetProfileId === profileId || notification.targetRole === role || (!notification.targetRole && !notification.targetProfileId)))
        ? { ...notification, readAt: new Date().toLocaleString('en-PH') }
        : notification
    )));
  }

  return {
    deals,
    clients,
    staff,
    tickets,
    calendarEvents,
    notifications,
    reportSnapshots,
    analytics,
    createLead,
    createReadinessLead,
    createPublicInquiry,
    updateLead,
    removeLead,
    qualifyLead,
    archiveLead,
    restoreLead,
    createClient,
    updateClient,
    archiveClient,
    restoreClient,
    linkClientToDeal,
    runPreAudit,
    runSolarEnrichment,
    requestSolarDispatchOverride,
    approveSolarDispatch,
    assignAndScheduleSurvey,
    assignSurvey,
    completeSurvey,
    addSurveyUpload,
    updateSurveyRoofSoundness,
    generateProposal,
    buildCheckoutEstimate,
    updateCheckoutBilling,
    updateCheckoutLine,
    addCheckoutLine,
    removeCheckoutLine,
    approveCheckoutPricing,
    freezeEstimate,
    requestQuote,
    setQuoteRequestStatus,
    convertQuoteToCheckout,
    updateNetMeteringStep,
    generateComplianceDocs,
    markNetMeteringReadyForLender,
    ownerOverrideSolarApi,
    generateContractLink,
    generateDealRoom,
    findDealRoomByToken,
    recordDealRoomView,
    requestDealRoomFormalQuote,
    generateRemoteIntakeLink,
    markRemoteIntakeSent,
    findRemoteIntakeByToken,
    recordRemoteIntakeUpload,
    uploadDealFile,
    validateFile,
    rejectFile,
    createDealFileSignedDownloadUrl,
    acceptContract,
    findContractByToken,
    submitCsReview,
    approveOwnerReview,
    updateOpportunity,
    archiveOpportunity,
    requestCancellation,
    requestRefund,
    approveRefund,
    rejectRefund,
    markRefundProcessing,
    completeRefund,
    createTicket,
    createCalendarEvent,
    scheduleInstallation,
    createBillingLedgerEvent,
    createReportSnapshot,
    approveAiSuggestion,
    updateStaffProfile,
    upsertStaffProfile,
    markNotificationRead,
    markAllNotificationsRead,
  };
}
