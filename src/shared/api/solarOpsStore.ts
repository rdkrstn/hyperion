// Legacy naming retained during the Solar Ops -> Hyperion transition.
import { createClientPortal } from '../../domains/client-portal/services/clientPortalService';
import type { ClientPortalRecord } from '../../domains/client-portal/types';
import { markDealOutcome, createDealFromLead as createDomainDeal, scheduleSurveyGate } from '../../domains/deals/services/dealService';
import type { DealRecord } from '../../domains/deals/types';
import { createDocumentRecord, proposalDocumentGate, rejectDocument as rejectDomainDocument, replaceDocumentFile as replaceDomainDocumentFile, validateDocument as validateDomainDocument } from '../../domains/documents/services/documentService';
import type { DocumentRecord } from '../../domains/documents/types';
import { annualizeBillHistory, summarizeBillHistory } from '../../domains/leads/services/billHistoryService';
import { localMeralcoFixtureExtraction } from '../../domains/leads/services/energyChartService';
import { createLeadRecord, formatPinnedLocation, qualifyLead as qualifyDomainLead, recalculateLeadQualification } from '../../domains/leads/services/leadService';
import type { BillHistoryMonth, CustomerType, LeadGoal, LeadInput, LeadRecord, SiteControl } from '../../domains/leads/types';
import { buildNetMeteringWorkflowView } from '../../domains/net-metering/services/netMeteringWorkflowService';
import { acceptContract as acceptDomainContract, createProposalDraft, freezeProposal as freezeDomainProposal, generateContract as generateDomainContract } from '../../domains/proposals/services/proposalService';
import type { ClientRecord, InvoiceRecord, PaymentLedgerEvent, ProposalContract, ProposalRecord } from '../../domains/proposals/types';
import { runLocalSolarSnapshot, updatePanelLayout } from '../../domains/solar-snapshot/services/solarSnapshotService';
import type { SolarSnapshot } from '../../domains/solar-snapshot/types';
import { addSurveyEvidence, requiredSurveyEvidence, scheduleSurvey as scheduleDomainSurvey, surveyValidationGate, validateSurvey as validateDomainSurvey } from '../../domains/surveys/services/surveyService';
import type { SurveyEvidenceCategory, SurveyRecord } from '../../domains/surveys/types';
import type { TicketRecord } from '../../domains/tickets/types';
import { makeId, nowIso, type ActionResult, type Role, type TimelineEvent } from '../types/app';
import { buildDemoSeed, isDemoSeedId } from './demoSeed';
import { buildGoldenDemoModel, goldenDemoDealId, goldenDemoLeadId, type GoldenDemoModel } from '../demo/goldenDemo';

export interface CalendarEventRecord {
  id: string;
  type: 'survey' | 'installation' | 'follow_up';
  linkedDealId?: string;
  linkedSurveyId?: string;
  title: string;
  startAt: string;
  location: string;
}

export interface SolarOpsState {
  leads: LeadRecord[];
  deals: DealRecord[];
  solarSnapshots: SolarSnapshot[];
  surveys: SurveyRecord[];
  documents: DocumentRecord[];
  proposals: ProposalRecord[];
  proposalContracts: ProposalContract[];
  invoices: InvoiceRecord[];
  paymentLedgerEvents: PaymentLedgerEvent[];
  clientPortals: ClientPortalRecord[];
  clients: ClientRecord[];
  tickets: TicketRecord[];
  calendarEvents: CalendarEventRecord[];
  timelineEvents: TimelineEvent[];
}

export function createInitialSolarOpsState(): SolarOpsState {
  return {
    leads: [],
    deals: [],
    solarSnapshots: [],
    surveys: [],
    documents: [],
    proposals: [],
    proposalContracts: [],
    invoices: [],
    paymentLedgerEvents: [],
    clientPortals: [],
    clients: [],
    tickets: [],
    calendarEvents: [],
    timelineEvents: [],
  };
}

function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

type SetState = (next: SolarOpsState) => void;
type GetState = () => SolarOpsState;
type LeadQualificationPatch = Partial<{
  siteControl: SiteControl;
  customerType: CustomerType;
  monthlyBill: number;
  monthlyKwh: number;
  daytimeUsage: LeadRecord['energyProfile']['daytimeUsage'];
  goal: LeadGoal;
  utilityProvider: string;
}>;

export function createTimeline(ownerType: TimelineEvent['ownerType'], ownerId: string, title: string, description: string, actorRole: Role | 'system' = 'system'): TimelineEvent {
  return {
    id: makeId('timeline'),
    ownerType,
    ownerId,
    title,
    description,
    actorRole,
    createdAt: nowIso(),
  };
}

function replaceById<T extends { id: string }>(records: T[], updated: T) {
  return records.map((record) => (record.id === updated.id ? updated : record));
}

function appendTimeline(state: SolarOpsState, event: TimelineEvent) {
  return { ...state, timelineEvents: [event, ...state.timelineEvents] };
}

function syncDealDocumentStatus(deal: DealRecord, documents: DocumentRecord[]): DealRecord {
  const gate = proposalDocumentGate({ documents, dealId: deal.id, leadId: deal.leadId });
  const linked = documents.filter((document) => document.dealId === deal.id || document.leadId === deal.leadId);
  const pending = gate.requirements.some((requirement) => requirement.status === 'pending_validation')
    || linked.some((document) => document.validationStatus === 'pending_validation');
  return {
    ...deal,
    documentStatus: gate.allowed ? 'validated' : pending ? 'pending_validation' : 'missing',
    blocker: gate.allowed && deal.blocker?.startsWith('Validate required documents') ? undefined : gate.allowed ? deal.blocker : gate.reason,
    nextAction: gate.allowed && deal.nextAction.startsWith('Validate required documents') ? 'Build proposal.' : gate.allowed ? deal.nextAction : gate.reason,
    updatedAt: nowIso(),
  };
}

function findDealSolarSnapshot(state: SolarOpsState, deal: DealRecord) {
  return state.solarSnapshots.find((snapshot) => snapshot.dealId === deal.id || snapshot.leadId === deal.leadId);
}

function buildLocalEnergyGraphSource(lead: LeadRecord): BillHistoryMonth[] {
  const baseBill = Math.max(lead.energyProfile.monthlyBill || 0, 1);
  const baseKwh = lead.energyProfile.monthlyKwh ?? Math.round(baseBill / 12.5);
  const factors = [0.88, 0.97, 1.05, 1.12, 0.94, 1.02];
  return factors.map((factor, index) => ({
    periodLabel: `Observed ${index + 1}`,
    billAmount: Math.round(baseBill * factor),
    kwh: Math.max(1, Math.round(baseKwh * factor)),
    source: 'observed',
  }));
}

function mergeDemoSeed(state: SolarOpsState): SolarOpsState {
  const demo = buildDemoSeed();
  const demoDealIds = new Set(demo.deals.map((deal) => deal.id));
  const demoLeadIds = new Set(demo.leads.map((lead) => lead.id));
  const demoProposalIds = new Set<string>();
  const withoutDemo: SolarOpsState = {
    ...state,
    leads: state.leads.filter((lead) => !isDemoSeedId(lead.id)),
    deals: state.deals.filter((deal) => !isDemoSeedId(deal.id) && !demoLeadIds.has(deal.leadId)),
    solarSnapshots: state.solarSnapshots.filter((snapshot) => !isDemoSeedId(snapshot.id) && !demoLeadIds.has(snapshot.leadId) && !demoDealIds.has(snapshot.dealId ?? '')),
    surveys: state.surveys.filter((survey) => !isDemoSeedId(survey.id) && !demoDealIds.has(survey.dealId)),
    documents: state.documents.filter((document) => !isDemoSeedId(document.id) && !demoLeadIds.has(document.leadId ?? '') && !demoDealIds.has(document.dealId ?? '')),
    proposals: state.proposals.filter((proposal) => !isDemoSeedId(proposal.id) && !demoDealIds.has(proposal.dealId)),
    proposalContracts: state.proposalContracts.filter((contract) => !isDemoSeedId(contract.id) && !demoDealIds.has(contract.dealId) && !demoProposalIds.has(contract.proposalId)),
    invoices: state.invoices.filter((invoice) => !isDemoSeedId(invoice.id) && !demoDealIds.has(invoice.dealId)),
    paymentLedgerEvents: state.paymentLedgerEvents.filter((event) => !isDemoSeedId(event.id)),
    clientPortals: state.clientPortals.filter((portal) => !isDemoSeedId(portal.id) && !demoDealIds.has(portal.dealId)),
    clients: state.clients.filter((client) => !isDemoSeedId(client.id)),
    tickets: state.tickets.filter((ticket) => !isDemoSeedId(ticket.id)),
    calendarEvents: state.calendarEvents.filter((event) => !isDemoSeedId(event.id) && !demoDealIds.has(event.linkedDealId ?? '')),
    timelineEvents: state.timelineEvents.filter((event) => !isDemoSeedId(event.id) && !demoLeadIds.has(event.ownerId) && !demoDealIds.has(event.ownerId) && !demoProposalIds.has(event.ownerId)),
  };
  return {
    ...withoutDemo,
    leads: [...demo.leads, ...withoutDemo.leads],
    deals: [...demo.deals, ...withoutDemo.deals],
    solarSnapshots: [...demo.solarSnapshots, ...withoutDemo.solarSnapshots],
    documents: [...demo.documents, ...withoutDemo.documents],
    timelineEvents: [...demo.timelineEvents, ...withoutDemo.timelineEvents],
  };
}

export function createSolarOpsActions(getState: GetState, setState: SetState) {
  return {
    loadDemoData(): ActionResult<SolarOpsState> {
      const next = mergeDemoSeed(getState());
      setState(next);
      return ok(next, 'Demo data loaded.');
    },

    loadGoldenDemo(): ActionResult<GoldenDemoModel> {
      const next = mergeDemoSeed(getState());
      setState(next);
      return ok(buildGoldenDemoModel(next), 'Golden demo loaded.');
    },

    resetDemo(): ActionResult<SolarOpsState> {
      const next = createInitialSolarOpsState();
      setState(next);
      return ok(next, 'Demo reset.');
    },

    runGoldenDemoNextStep(): ActionResult<GoldenDemoModel> {
      const state = getState();
      const model = buildGoldenDemoModel(state);
      if (!model.loaded) {
        const next = mergeDemoSeed(state);
        setState(next);
        return ok(buildGoldenDemoModel(next), 'Golden demo loaded.');
      }

      const lead = state.leads.find((item) => item.id === goldenDemoLeadId);
      const deal = state.deals.find((item) => item.id === goldenDemoDealId);
      if (!lead || !deal) return fail('Golden demo account is missing. Load the demo again.');

      if (model.currentStepId === 'docs') {
        const documents = state.documents.map((document) => (
          (document.leadId === goldenDemoLeadId || document.dealId === goldenDemoDealId)
            && ['valid_id', 'site_control_document'].includes(document.category)
            ? validateDomainDocument(document, 'cs-demo')
            : document
        ));
        const updatedDeal = syncDealDocumentStatus(deal, documents);
        const nextState = appendTimeline(
          { ...state, documents, deals: replaceById(state.deals, updatedDeal) },
          createTimeline('deal', deal.id, 'Golden demo documents validated', 'Valid ID and site-control document were validated in local demo mode.', 'cs'),
        );
        setState(nextState);
        return ok(buildGoldenDemoModel(nextState), 'Golden demo documents validated.');
      }

      if (model.currentStepId === 'survey') {
        let survey = state.surveys.find((item) => item.dealId === goldenDemoDealId);
        if (!survey) {
          survey = scheduleDomainSurvey(deal, {
            installerId: 'installer-demo',
            scheduledAt: '2026-06-12T09:00',
            location: deal.leadSnapshot.location,
          });
        }
        for (const category of requiredSurveyEvidence) {
          survey = addSurveyEvidence(survey, {
            category,
            fileName: `${category}-demo.jpg`,
            mimeType: 'image/jpeg',
            storagePath: `${survey.id}/${category}-demo.jpg`,
          });
        }
        survey = validateDomainSurvey({ ...survey, isStructurallySound: true, blockers: [] });
        const updatedDeal: DealRecord = {
          ...deal,
          stage: 'survey_validated',
          surveyStatus: 'validated',
          nextAction: 'Build proposal.',
          updatedAt: nowIso(),
        };
        const calendarEvent: CalendarEventRecord = {
          id: makeId('calendar-demo'),
          type: 'survey',
          linkedDealId: deal.id,
          linkedSurveyId: survey.id,
          title: `Survey: ${deal.name}`,
          startAt: survey.scheduledAt,
          location: survey.location,
        };
        const surveys = state.surveys.some((item) => item.id === survey!.id)
          ? replaceById(state.surveys, survey)
          : [survey, ...state.surveys];
        const nextState = appendTimeline(
          { ...state, surveys, deals: replaceById(state.deals, updatedDeal), calendarEvents: [calendarEvent, ...state.calendarEvents] },
          createTimeline('survey', survey.id, 'Golden demo installer survey validated', 'Required installer evidence and roof soundness were completed locally.', 'installer'),
        );
        setState(nextState);
        return ok(buildGoldenDemoModel(nextState), 'Golden demo installer survey validated.');
      }

      if (model.currentStepId === 'proposal') {
        const documentSyncedDeal = syncDealDocumentStatus(deal, state.documents);
        const solarSnapshot = findDealSolarSnapshot(state, documentSyncedDeal);
        if (!solarSnapshot) return fail('Golden demo Solar Snapshot is missing.');
        const active = state.proposals.find((proposal) => proposal.dealId === deal.id && proposal.isActive);
        const draft = createProposalDraft(documentSyncedDeal, {
          systemSizeKwp: solarSnapshot.selectedSystemSizeKwp || 12.6,
          previousProposalId: active?.id,
          solarSnapshot,
        });
        const frozen = freezeDomainProposal(draft);
        const proposals = [frozen, ...state.proposals.map((item) => (item.dealId === deal.id ? { ...item, isActive: false } : item))];
        const updatedDeal: DealRecord = {
          ...documentSyncedDeal,
          stage: 'proposal_built',
          proposalStatus: frozen.status,
          value: frozen.subtotal,
          commercialPacket: {
            ...documentSyncedDeal.commercialPacket,
            proposedSystemSizeKwp: frozen.systemSizeKwp,
            estimatedPrice: frozen.subtotal,
            grossMarginPercent: frozen.grossMarginPercent,
          },
          nextAction: 'Generate contract-ready handoff.',
          updatedAt: nowIso(),
        };
        const nextState = appendTimeline(
          { ...state, proposals, deals: replaceById(state.deals, updatedDeal) },
          createTimeline('proposal', frozen.id, 'Golden demo proposal generated', `Frozen proposal revision ${frozen.revision} created for ${frozen.systemSizeKwp} kWp.`, 'sales'),
        );
        setState(nextState);
        return ok(buildGoldenDemoModel(nextState), 'Golden demo proposal generated and frozen.');
      }

      if (model.currentStepId === 'contract') {
        const activeProposal = state.proposals.find((proposal) => proposal.dealId === deal.id && proposal.isActive);
        if (!activeProposal) return fail('Generate the golden demo proposal first.');
        const contract = state.proposalContracts.find((item) => item.proposalId === activeProposal.id);
        if (!contract) {
          const nextContract = generateDomainContract(activeProposal, deal, typeof window === 'undefined' ? 'http://127.0.0.1:5173' : window.location.origin);
          const updatedDeal = { ...deal, contractStatus: 'sent' as const, nextAction: 'Capture typed contract acceptance.', updatedAt: nowIso() };
          const nextState = appendTimeline(
            { ...state, proposalContracts: [nextContract, ...state.proposalContracts], deals: replaceById(state.deals, updatedDeal) },
            createTimeline('proposal', activeProposal.id, 'Golden demo contract link generated', nextContract.publicUrl, 'sales'),
          );
          setState(nextState);
          return ok(buildGoldenDemoModel(nextState), 'Golden demo contract link generated.');
        }
        if (contract.status !== 'signed') {
          const accepted = acceptDomainContract(contract, activeProposal, deal, 'Ramon Dela Cruz');
          const updatedDeal = {
            ...deal,
            stage: 'contract_accepted' as const,
            proposalStatus: 'accepted' as const,
            contractStatus: 'signed' as const,
            paymentStatus: accepted.paymentLedgerEvent.status,
            nextAction: 'Mark deal won.',
            updatedAt: nowIso(),
          };
          const nextState = appendTimeline(
            {
              ...state,
              proposalContracts: replaceById(state.proposalContracts, accepted.contract),
              proposals: replaceById(state.proposals, accepted.proposal),
              invoices: [accepted.invoice, ...state.invoices],
              paymentLedgerEvents: [accepted.paymentLedgerEvent, ...state.paymentLedgerEvents],
              clients: [accepted.client, ...state.clients],
              deals: replaceById(state.deals, updatedDeal),
            },
            createTimeline('deal', deal.id, 'Golden demo contract accepted', 'Ramon Dela Cruz accepted the frozen proposal locally.', 'client'),
          );
          setState(nextState);
          return ok(buildGoldenDemoModel(nextState), 'Golden demo contract accepted.');
        }
        const wonDeal = markDealOutcome(deal, 'won', 'Golden demo contract-ready handoff completed.');
        const nextState = appendTimeline(
          { ...state, deals: replaceById(state.deals, wonDeal) },
          createTimeline('deal', deal.id, 'Golden demo completed', 'Iloilo Mini Mart reached won handoff in local demo mode.', 'sales'),
        );
        setState(nextState);
        return ok(buildGoldenDemoModel(nextState), 'Golden demo marked won.');
      }

      return ok(model, 'Golden demo is complete.');
    },

    createLead(input: LeadInput): ActionResult<LeadRecord> {
      const lead = createLeadRecord(input);
      const state = getState();
      const hasPin = Number.isFinite(lead.siteProfile.latitude) && Number.isFinite(lead.siteProfile.longitude);
      const snapshot = hasPin ? runLocalSolarSnapshot(lead) : undefined;
      const withLeadCapture = appendTimeline(
        { ...state, leads: [lead, ...state.leads], solarSnapshots: snapshot ? [snapshot, ...state.solarSnapshots] : state.solarSnapshots },
        createTimeline('lead', lead.id, 'Lead captured', `${lead.businessName} was captured from ${lead.source}.`, 'sales'),
      );
      const nextState = snapshot
        ? appendTimeline(withLeadCapture, createTimeline('lead', lead.id, 'Solar Snapshot reviewed', snapshot.nextAction, 'system'))
        : withLeadCapture;
      setState(nextState);
      return ok(lead, snapshot ? 'Lead created and Solar Snapshot reviewed from pin.' : 'Lead created.');
    },

    qualifyLead(leadId: string, overrideReason?: string): ActionResult<LeadRecord> {
      const state = getState();
      const lead = state.leads.find((item) => item.id === leadId);
      if (!lead) return fail('Lead not found.');
      const updated = qualifyDomainLead(lead, overrideReason ? { overrideReason } : undefined);
      setState(appendTimeline(
        { ...state, leads: replaceById(state.leads, updated) },
        createTimeline('lead', leadId, 'Lead qualified', overrideReason ? `Qualified with override: ${overrideReason}` : 'Minimum qualification completed.', 'sales'),
      ));
      return ok(updated, 'Lead qualified.');
    },

    generateEnergyGraph(leadId: string): ActionResult<LeadRecord> {
      const state = getState();
      const lead = state.leads.find((item) => item.id === leadId);
      if (!lead) return fail('Lead not found.');
      if (!lead.energyProfile.monthlyBill && !lead.energyProfile.monthlyKwh) {
        return fail('Add a monthly bill or kWh estimate before generating the energy graph.');
      }

      const annualized = annualizeBillHistory(buildLocalEnergyGraphSource(lead));
      const summary = summarizeBillHistory(annualized.months);
      const billUpload = {
        id: makeId('bill'),
        leadId,
        status: 'ocr_completed' as const,
        extractedMonthlyKwh: summary.averageMonthlyKwh,
        extractedBillAmount: summary.averageMonthlyBill,
        billingPeriod: 'Local energy graph',
        provider: lead.siteProfile.utilityProvider,
        confidence: 0.82,
        ocrProvider: 'manual' as const,
        monthlySeries: annualized.months,
        annualized: annualized.annualized,
        sourceMonthCount: annualized.sourceMonthCount,
      };
      const updatedLead: LeadRecord = {
        ...lead,
        billUploads: [billUpload, ...lead.billUploads],
        energyProfile: {
          ...lead.energyProfile,
          billHistory: annualized.months,
          annualizedMonthlyBill: summary.averageMonthlyBill,
          annualizedMonthlyKwh: summary.averageMonthlyKwh,
          billHistoryMonths: annualized.sourceMonthCount,
          billHistoryAnnualized: annualized.annualized,
        },
        updatedAt: nowIso(),
      };

      setState(appendTimeline(
        { ...state, leads: replaceById(state.leads, updatedLead) },
        createTimeline('lead', leadId, 'Energy graph generated', `${annualized.sourceMonthCount} observed months annualized into a 12-month bill graph.`, 'sales'),
      ));
      return ok(updatedLead, 'Energy graph generated.');
    },

    runBillOcrForDocument(documentId: string): ActionResult<LeadRecord> {
      const state = getState();
      const document = state.documents.find((item) => item.id === documentId);
      if (!document) return fail('Document not found.');
      if (document.category !== 'customer_bill') return fail('Gemini OCR can only run on Customer Bill documents.');
      if (!document.leadId) return fail('Customer Bill must be linked to a lead before OCR.');
      const lead = state.leads.find((item) => item.id === document.leadId);
      if (!lead) return fail('Linked lead not found for Customer Bill OCR.');
      if (!document.fileDataUrl) {
        return fail('Missing file payload. Supabase mode must request the private Storage object before bill-ocr-preaudit can run.');
      }
      const fixture = localMeralcoFixtureExtraction(document.fileName) ?? localMeralcoFixtureExtraction(document.storagePath.split('/').at(-1) ?? '');
      if (!fixture) {
        return fail('Local OCR fixture not recognized. In production, upload this bill to Supabase Storage and run bill-ocr-preaudit with GEMINI_API_KEY.');
      }

      const annualized = annualizeBillHistory(fixture.series);
      const summary = summarizeBillHistory(annualized.months);
      const billUpload = {
        id: makeId('bill'),
        leadId: lead.id,
        documentId: document.id,
        status: fixture.confidence < 0.65 ? 'manual_review' as const : 'ocr_completed' as const,
        extractedMonthlyKwh: summary.averageMonthlyKwh,
        extractedBillAmount: summary.averageMonthlyBill,
        billingPeriod: fixture.series[0]?.periodLabel,
        accountName: fixture.accountName,
        provider: fixture.provider,
        confidence: fixture.confidence,
        ocrProvider: 'manual' as const,
        monthlySeries: annualized.months,
        annualized: annualized.annualized,
        sourceMonthCount: annualized.sourceMonthCount,
      };
      const updatedLead: LeadRecord = {
        ...lead,
        billUploads: [billUpload, ...lead.billUploads],
        energyProfile: {
          ...lead.energyProfile,
          monthlyBill: summary.averageMonthlyBill || lead.energyProfile.monthlyBill,
          monthlyKwh: summary.averageMonthlyKwh ?? lead.energyProfile.monthlyKwh,
          billHistory: annualized.months,
          annualizedMonthlyBill: summary.averageMonthlyBill,
          annualizedMonthlyKwh: summary.averageMonthlyKwh,
          billHistoryMonths: annualized.sourceMonthCount,
          billHistoryAnnualized: annualized.annualized,
        },
        updatedAt: nowIso(),
      };

      setState(appendTimeline(
        { ...state, leads: replaceById(state.leads, updatedLead) },
        createTimeline(
          'lead',
          lead.id,
          'Energy graph generated',
          `${fixture.label}: ${annualized.sourceMonthCount} observed bill month${annualized.sourceMonthCount === 1 ? '' : 's'} annualized into a 12-month energy graph.`,
          'sales',
        ),
      ));
      return ok(updatedLead, 'Energy graph generated from local bill fixture.');
    },

    updateLeadQualification(leadId: string, input: LeadQualificationPatch): ActionResult<LeadRecord> {
      const state = getState();
      const lead = state.leads.find((item) => item.id === leadId);
      if (!lead) return fail('Lead not found.');
      const patched: LeadRecord = {
        ...lead,
        customerType: input.customerType ?? lead.customerType,
        goal: input.goal ?? lead.goal,
        siteProfile: {
          ...lead.siteProfile,
          siteControl: input.siteControl ?? lead.siteProfile.siteControl,
          utilityProvider: input.utilityProvider ?? lead.siteProfile.utilityProvider,
        },
        energyProfile: {
          ...lead.energyProfile,
          monthlyBill: Number.isFinite(input.monthlyBill) ? input.monthlyBill! : lead.energyProfile.monthlyBill,
          monthlyKwh: Number.isFinite(input.monthlyKwh) ? input.monthlyKwh : lead.energyProfile.monthlyKwh,
          daytimeUsage: input.daytimeUsage ?? lead.energyProfile.daytimeUsage,
        },
      };
      const updated = recalculateLeadQualification(patched);
      setState(appendTimeline(
        { ...state, leads: replaceById(state.leads, updated) },
        createTimeline('lead', leadId, 'Qualification answers updated', 'Business fit, site-control, or energy qualification answers were updated.', 'sales'),
      ));
      return ok(updated, 'Qualification updated.');
    },

    createDealFromLead(leadId: string, input: { name: string; salesOwner: string; expectedCloseDate?: string }): ActionResult<DealRecord> {
      const state = getState();
      const lead = state.leads.find((item) => item.id === leadId);
      if (!lead) return fail('Lead not found.');
      try {
        const deal = createDomainDeal(lead, input);
        const leadSnapshot = state.solarSnapshots.find((item) => item.leadId === lead.id && !item.dealId);
        const dealSnapshot = leadSnapshot ? { ...leadSnapshot, id: makeId('solar'), dealId: deal.id, updatedAt: nowIso() } : undefined;
        const updatedLead = { ...lead, status: 'deal_created' as const, nextAction: 'Review deal and Solar Snapshot.', updatedAt: nowIso() };
        const updatedDeal = dealSnapshot
          ? { ...deal, solarSnapshotStatus: dealSnapshot.status === 'ready' ? 'ready' as const : dealSnapshot.status, stage: dealSnapshot.status === 'ready' ? 'solar_snapshot_reviewed' as const : deal.stage, nextAction: dealSnapshot.status === 'ready' ? 'Schedule survey.' : deal.nextAction }
          : deal;
        setState(appendTimeline(
          { ...state, leads: replaceById(state.leads, updatedLead), deals: [updatedDeal, ...state.deals], solarSnapshots: dealSnapshot ? [dealSnapshot, ...state.solarSnapshots] : state.solarSnapshots },
          createTimeline('deal', deal.id, 'Deal created', `${deal.name} was created from ${lead.businessName}.`, 'sales'),
        ));
        return ok(updatedDeal, 'Deal created.');
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Unable to create deal.');
      }
    },

    runSolarSnapshot(leadId: string, dealId?: string, pin?: { latitude: number; longitude: number }): ActionResult<SolarSnapshot> {
      const state = getState();
      const lead = state.leads.find((item) => item.id === leadId);
      if (!lead) return fail('Lead not found.');
      const pinnedLead = pin
        ? { ...lead, siteProfile: { ...lead.siteProfile, latitude: pin.latitude, longitude: pin.longitude, location: lead.siteProfile.location || formatPinnedLocation(pin.latitude, pin.longitude) } }
        : lead;
      const deal = dealId ? state.deals.find((item) => item.id === dealId) : undefined;
      const snapshot = runLocalSolarSnapshot(pinnedLead, deal);
      const updatedDeals = deal
        ? replaceById(state.deals, {
          ...deal,
          solarSnapshotStatus: snapshot.status === 'ready' ? 'ready' : snapshot.status,
          stage: snapshot.status === 'ready' ? 'solar_snapshot_reviewed' : deal.stage,
          nextAction: snapshot.status === 'ready' ? 'Schedule survey.' : snapshot.nextAction,
          blocker: snapshot.status === 'ready' ? undefined : snapshot.riskFlags[0],
          updatedAt: nowIso(),
        })
        : state.deals;
      setState(appendTimeline(
        {
          ...state,
          leads: replaceById(state.leads, pinnedLead),
          deals: updatedDeals,
          solarSnapshots: [snapshot, ...state.solarSnapshots.filter((item) => item.leadId !== leadId || item.dealId !== dealId)],
        },
        createTimeline(deal ? 'deal' : 'lead', deal?.id ?? lead.id, 'Solar Snapshot reviewed', snapshot.nextAction, 'sales'),
      ));
      return ok(snapshot, 'Solar Snapshot reviewed.');
    },

    updateSolarPanelLayout(snapshotId: string, input: { panelCount: number; panelCapacityWatts?: number }): ActionResult<SolarSnapshot> {
      const state = getState();
      const snapshot = state.solarSnapshots.find((item) => item.id === snapshotId);
      if (!snapshot) return fail('Solar Snapshot not found.');
      try {
        const updated = updatePanelLayout(snapshot, input);
        const ownerType = snapshot.dealId ? 'deal' : 'lead';
        const ownerId = snapshot.dealId ?? snapshot.leadId;
        const timeline = createTimeline(
          ownerType,
          ownerId,
          'Solar panel layout updated',
          `${updated.selectedPanelCount} panels selected for ${updated.selectedSystemSizeKwp} kWp.`,
          'sales',
        );
        setState({
          ...state,
          solarSnapshots: replaceById(state.solarSnapshots, updated),
          timelineEvents: [
            timeline,
            ...state.timelineEvents.filter((event) => !(event.ownerId === ownerId && event.title === 'Solar panel layout updated')),
          ],
        });
        return ok(updated, 'Panel layout updated.');
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Unable to update panel layout.');
      }
    },

    scheduleSurvey(dealId: string, input: { installerId: string; scheduledAt: string; location: string; accessInstructions?: string }): ActionResult<SurveyRecord> {
      const state = getState();
      const deal = state.deals.find((item) => item.id === dealId);
      if (!deal) return fail('Deal not found.');
      const gate = scheduleSurveyGate(deal);
      if (!gate.allowed) return fail(gate.reason);
      try {
        const survey = scheduleDomainSurvey(deal, input);
        const updatedDeal: DealRecord = {
          ...deal,
          stage: 'survey_scheduled',
          surveyStatus: 'scheduled',
          nextAction: 'Installer must upload evidence and validate survey.',
          updatedAt: nowIso(),
        };
        const calendarEvent: CalendarEventRecord = {
          id: makeId('calendar'),
          type: 'survey',
          linkedDealId: deal.id,
          linkedSurveyId: survey.id,
          title: `Survey: ${deal.name}`,
          startAt: input.scheduledAt,
          location: input.location,
        };
        setState(appendTimeline(
          { ...state, deals: replaceById(state.deals, updatedDeal), surveys: [survey, ...state.surveys], calendarEvents: [calendarEvent, ...state.calendarEvents] },
          createTimeline('survey', survey.id, 'Survey scheduled', `${deal.name} was assigned to ${input.installerId}.`, 'sales'),
        ));
        return ok(survey, 'Survey scheduled.');
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Unable to schedule survey.');
      }
    },

    uploadSurveyEvidence(surveyId: string, input: { category: SurveyEvidenceCategory; fileName: string; mimeType: string; storagePath: string; previewUrl?: string }): ActionResult<SurveyRecord> {
      const state = getState();
      const survey = state.surveys.find((item) => item.id === surveyId);
      if (!survey) return fail('Survey not found.');
      const updated = addSurveyEvidence(survey, input);
      setState(appendTimeline(
        { ...state, surveys: replaceById(state.surveys, updated) },
        createTimeline('survey', survey.id, 'Survey evidence uploaded', `${input.category.replaceAll('_', ' ')} uploaded.`, 'installer'),
      ));
      return ok(updated, 'Survey evidence uploaded.');
    },

    setSurveyStructuralSoundness(surveyId: string, isStructurallySound: boolean): ActionResult<SurveyRecord> {
      const state = getState();
      const survey = state.surveys.find((item) => item.id === surveyId);
      if (!survey) return fail('Survey not found.');
      const updated = {
        ...survey,
        isStructurallySound,
        validationOutcome: isStructurallySound ? survey.validationOutcome : 'blocked' as const,
        blockers: isStructurallySound ? survey.blockers : ['Survey Blocked: Roof requires engineering remediation plan before proceeding.'],
        updatedAt: nowIso(),
      };
      setState(appendTimeline(
        { ...state, surveys: replaceById(state.surveys, updated) },
        createTimeline('survey', survey.id, 'Roof soundness recorded', isStructurallySound ? 'Roof marked structurally sound.' : 'Engineering remediation required.', 'installer'),
      ));
      return ok(updated, 'Roof soundness saved.');
    },

    validateSurvey(surveyId: string): ActionResult<SurveyRecord> {
      const state = getState();
      const survey = state.surveys.find((item) => item.id === surveyId);
      if (!survey) return fail('Survey not found.');
      const gate = surveyValidationGate(survey);
      if (!gate.allowed) return fail(gate.reason);
      const updatedSurvey = validateDomainSurvey(survey);
      const deal = state.deals.find((item) => item.id === survey.dealId);
      const updatedDeals = deal
        ? replaceById(state.deals, {
          ...deal,
          stage: 'survey_validated',
          surveyStatus: 'validated',
          nextAction: 'Validate documents and build proposal.',
          updatedAt: nowIso(),
        })
        : state.deals;
      setState(appendTimeline(
        { ...state, surveys: replaceById(state.surveys, updatedSurvey), deals: updatedDeals },
        createTimeline('survey', survey.id, 'Survey validated', 'Installer completed required evidence and findings.', 'installer'),
      ));
      return ok(updatedSurvey, 'Survey validated.');
    },

    uploadDocument(input: Parameters<typeof createDocumentRecord>[0]): ActionResult<DocumentRecord> {
      const document = createDocumentRecord(input);
      const state = getState();
      const deals = document.dealId
        ? state.deals.map((deal) => (deal.id === document.dealId ? syncDealDocumentStatus(deal, [document, ...state.documents]) : deal))
        : state.deals;
      setState(appendTimeline(
        { ...state, documents: [document, ...state.documents], deals },
        createTimeline('document', document.id, 'Document uploaded', `${document.fileName} is pending validation.`, 'sales'),
      ));
      return ok(document, 'Document uploaded.');
    },

    replaceDocumentFile(documentId: string, input: {
      fileName: string;
      mimeType: string;
      storagePath: string;
      fileSizeBytes?: number;
      fileDataUrl?: string;
    }): ActionResult<DocumentRecord> {
      const state = getState();
      const document = state.documents.find((item) => item.id === documentId);
      if (!document) return fail('Document not found.');
      const updatedDocument = replaceDomainDocumentFile(document, input);
      const documents = replaceById(state.documents, updatedDocument);
      const deals = state.deals.map((deal) => syncDealDocumentStatus(deal, documents));
      setState(appendTimeline(
        { ...state, documents, deals },
        createTimeline('document', document.id, 'Document replaced', `${updatedDocument.fileName} replaced the previous file and is pending validation.`, 'sales'),
      ));
      return ok(updatedDocument, 'Document replaced.');
    },

    deleteDocument(documentId: string): ActionResult<{ id: string }> {
      const state = getState();
      const document = state.documents.find((item) => item.id === documentId);
      if (!document) return fail('Document not found.');
      const documents = state.documents.filter((item) => item.id !== documentId);
      const deals = state.deals.map((deal) => syncDealDocumentStatus(deal, documents));
      setState(appendTimeline(
        { ...state, documents, deals },
        createTimeline('document', document.id, 'Document deleted', `${document.fileName} was removed from the file vault.`, 'sales'),
      ));
      return ok({ id: documentId }, 'Document deleted.');
    },

    validateDocument(documentId: string, validatedBy: string): ActionResult<DocumentRecord> {
      const state = getState();
      const document = state.documents.find((item) => item.id === documentId);
      if (!document) return fail('Document not found.');
      const updatedDocument = validateDomainDocument(document, validatedBy);
      const documents = replaceById(state.documents, updatedDocument);
      const deals = state.deals.map((deal) => syncDealDocumentStatus(deal, documents));
      setState(appendTimeline(
        { ...state, documents, deals },
        createTimeline('document', document.id, 'Document validated', `${document.fileName} was validated.`, 'cs'),
      ));
      return ok(updatedDocument, 'Document validated.');
    },

    rejectDocument(documentId: string, validatedBy: string, reason: string): ActionResult<DocumentRecord> {
      const state = getState();
      const document = state.documents.find((item) => item.id === documentId);
      if (!document) return fail('Document not found.');
      if (!reason.trim()) return fail('Rejection reason is required.');
      const updatedDocument = rejectDomainDocument(document, validatedBy, reason);
      const documents = replaceById(state.documents, updatedDocument);
      const deals = state.deals.map((deal) => syncDealDocumentStatus(deal, documents));
      setState(appendTimeline(
        { ...state, documents, deals },
        createTimeline('document', document.id, 'Document rejected', `${document.fileName} was rejected: ${reason}`, 'cs'),
      ));
      return ok(updatedDocument, 'Document rejected.');
    },

    createProposal(dealId: string, input: { systemSizeKwp: number }): ActionResult<ProposalRecord> {
      const state = getState();
      const deal = state.deals.find((item) => item.id === dealId);
      if (!deal) return fail('Deal not found.');
      if (deal.stage !== 'survey_validated') return fail('Survey must be validated before proposal.');
      const documentSyncedDeal = syncDealDocumentStatus(deal, state.documents);
      const documentGate = proposalDocumentGate({ documents: state.documents, dealId: deal.id, leadId: deal.leadId });
      if (!documentGate.allowed) return fail(documentGate.reason);
      const solarSnapshot = findDealSolarSnapshot(state, documentSyncedDeal);
      if (!solarSnapshot || solarSnapshot.status !== 'ready' || solarSnapshot.selectedPanelCount <= 0) {
        return fail('Finalize a ready Solar Snapshot panel layout before proposal.');
      }
      const lead = state.leads.find((item) => item.id === deal.leadId);
      const netMeteringView = buildNetMeteringWorkflowView({
        deal: documentSyncedDeal,
        documents: state.documents,
        surveys: state.surveys,
        utilityProvider: lead?.siteProfile.utilityProvider,
      });
      if (!netMeteringView.readyForProposal) {
        return fail(`Net-metering gate blocked: ${netMeteringView.nextAction}`);
      }
      const active = state.proposals.find((proposal) => proposal.dealId === dealId && proposal.isActive);
      const proposal = createProposalDraft(documentSyncedDeal, { systemSizeKwp: input.systemSizeKwp, previousProposalId: active?.id, solarSnapshot });
      const proposals = [proposal, ...state.proposals.map((item) => (item.dealId === dealId ? { ...item, isActive: false } : item))];
      const updatedDeal = {
        ...documentSyncedDeal,
        proposalStatus: proposal.status,
        value: proposal.subtotal,
        commercialPacket: {
          ...deal.commercialPacket,
          proposedSystemSizeKwp: proposal.systemSizeKwp,
          estimatedPrice: proposal.subtotal,
          grossMarginPercent: proposal.grossMarginPercent,
        },
        nextAction: proposal.status === 'pricing_review_needed' ? 'Get pricing approval.' : 'Freeze proposal.',
        updatedAt: nowIso(),
      };
      setState(appendTimeline(
        { ...state, proposals, deals: replaceById(state.deals, updatedDeal) },
        createTimeline('proposal', proposal.id, 'Proposal draft created', `${proposal.systemSizeKwp} kWp proposal revision ${proposal.revision} created.`, 'sales'),
      ));
      return ok(proposal, 'Proposal created.');
    },

    freezeProposal(proposalId: string): ActionResult<ProposalRecord> {
      const state = getState();
      const proposal = state.proposals.find((item) => item.id === proposalId);
      if (!proposal) return fail('Proposal not found.');
      try {
        const frozen = freezeDomainProposal(proposal);
        const deal = state.deals.find((item) => item.id === proposal.dealId);
        const deals = deal
          ? replaceById(state.deals, { ...deal, stage: 'proposal_built', proposalStatus: frozen.status, nextAction: 'Share Client Portal.', updatedAt: nowIso() })
          : state.deals;
        setState(appendTimeline(
          { ...state, proposals: replaceById(state.proposals, frozen), deals },
          createTimeline('proposal', proposal.id, 'Proposal frozen', 'Active proposal was frozen for customer sharing.', 'sales'),
        ));
        return ok(frozen, 'Proposal frozen.');
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Unable to freeze proposal.');
      }
    },

    shareClientPortal(dealId: string): ActionResult<ClientPortalRecord> {
      const state = getState();
      const deal = state.deals.find((item) => item.id === dealId);
      if (!deal) return fail('Deal not found.');
      const portal = createClientPortal(deal, typeof window === 'undefined' ? 'http://127.0.0.1:5173' : window.location.origin);
      const updatedDeal = { ...deal, stage: 'client_portal_shared' as const, portalStatus: 'active' as const, nextAction: 'Send active proposal contract.', updatedAt: nowIso() };
      setState(appendTimeline(
        { ...state, clientPortals: [portal, ...state.clientPortals], deals: replaceById(state.deals, updatedDeal) },
        createTimeline('deal', deal.id, 'Client Portal shared', portal.publicUrl, 'sales'),
      ));
      return ok(portal, 'Client Portal shared.');
    },

    generateContract(dealId: string, proposalId: string): ActionResult<ProposalContract> {
      const state = getState();
      const deal = state.deals.find((item) => item.id === dealId);
      const proposal = state.proposals.find((item) => item.id === proposalId);
      if (!deal) return fail('Deal not found.');
      if (!proposal) return fail('Proposal not found.');
      try {
        const contract = generateDomainContract(proposal, deal, typeof window === 'undefined' ? 'http://127.0.0.1:5173' : window.location.origin);
        const updatedDeal = { ...deal, contractStatus: 'sent' as const, nextAction: 'Capture typed contract acceptance.', updatedAt: nowIso() };
        setState(appendTimeline(
          { ...state, proposalContracts: [contract, ...state.proposalContracts], deals: replaceById(state.deals, updatedDeal) },
          createTimeline('proposal', proposal.id, 'Contract link generated', contract.publicUrl, 'sales'),
        ));
        return ok(contract, 'Contract generated.');
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Unable to generate contract.');
      }
    },

    acceptContract(token: string, signerName: string): ActionResult<ClientRecord> {
      const state = getState();
      const contract = state.proposalContracts.find((item) => item.token === token);
      if (!contract) return fail('Contract not found.');
      const proposal = state.proposals.find((item) => item.id === contract.proposalId);
      const deal = state.deals.find((item) => item.id === contract.dealId);
      if (!proposal || !deal) return fail('Contract is stale.');
      try {
        const accepted = acceptDomainContract(contract, proposal, deal, signerName);
        const updatedDeal = { ...deal, stage: 'contract_accepted' as const, proposalStatus: 'accepted' as const, contractStatus: 'signed' as const, paymentStatus: accepted.paymentLedgerEvent.status, nextAction: 'Mark deal won and begin installation / net-metering / aftersales.', updatedAt: nowIso() };
        setState(appendTimeline(
          {
            ...state,
            proposalContracts: replaceById(state.proposalContracts, accepted.contract),
            proposals: replaceById(state.proposals, accepted.proposal),
            invoices: [accepted.invoice, ...state.invoices],
            paymentLedgerEvents: [accepted.paymentLedgerEvent, ...state.paymentLedgerEvents],
            clients: [accepted.client, ...state.clients],
            deals: replaceById(state.deals, updatedDeal),
          },
          createTimeline('deal', deal.id, 'Contract accepted', `${signerName} accepted the active frozen proposal.`, 'client'),
        ));
        return ok(accepted.client, 'Contract accepted.');
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Unable to accept contract.');
      }
    },

    markDealWon(dealId: string, reason: string): ActionResult<DealRecord> {
      const state = getState();
      const deal = state.deals.find((item) => item.id === dealId);
      if (!deal) return fail('Deal not found.');
      const updated = markDealOutcome(deal, 'won', reason);
      setState(appendTimeline(
        { ...state, deals: replaceById(state.deals, updated) },
        createTimeline('deal', deal.id, 'Deal won', reason, 'sales'),
      ));
      return ok(updated, 'Deal won.');
    },
  };
}

export type SolarOpsActions = ReturnType<typeof createSolarOpsActions>;
