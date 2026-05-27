import type { BillingLedgerEvent, ClientRecord, Deal, LeadInput, StaffProfile, SurveyApproval, SurveyUpload } from '../types';
import { buildBillingLedgerEvent, buildSurveyUpload, defaultQualification } from '../lib/coreOps';
import { createAcceptedInvoice, createCheckoutEstimate, createContractRecord, createMockBillingTransaction } from '../lib/checkout';
import { calculatePreAudit, scoreLead } from '../lib/scoring';

export const sampleLeadInput: LeadInput = {
  source: 'Facebook comment',
  businessName: 'Iloilo Fresh Laundry',
  contactName: 'Maria Santos',
  location: 'Mandurriao, Iloilo City',
  businessType: 'Laundry',
  averageMonthlyBill: 48000,
  tariff: 11,
  productionPerKwp: 110,
  pricePerKwp: 55000,
  propertyControl: 'Owns property',
  yearsInBusiness: '5+ years',
  revenueBand: '₱150k-₱500k / month',
  paymentBehavior: 'Consistent / current',
  purchaseTimeline: '1-3 months',
  interestLevel: 'Ready for site survey',
  preferredSurveySlot: '2026-05-22T10:00',
  staffNotes: 'Asked about installment options from a Facebook comment. High daytime laundry load.',
};

const audit = calculatePreAudit(sampleLeadInput);
const score = scoreLead(sampleLeadInput);

function baseDeal(id: string, code: string, lead: LeadInput): Deal {
  return {
    id,
    code,
    stage: 'captured',
    opportunityStatus: 'open',
    archiveState: 'active',
    lead,
    qualification: defaultQualification(lead),
    assignedSales: 'Ana Sales',
    readinessUploads: [],
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
      { id: `${id}-task-1`, ownerRole: 'sales', title: 'Confirm decision maker and monthly bill', status: 'open', dueLabel: 'Today' },
      { id: `${id}-task-2`, ownerRole: 'cs', title: 'Prepare document checklist request', status: 'open', dueLabel: 'After proposal' },
    ],
    aiSuggestions: [
      {
        id: `${id}-ai-1`,
        type: 'summary',
        title: 'Lead summary draft',
        body: `${lead.businessName} is a ${lead.businessType.toLowerCase()} lead with ${lead.averageMonthlyBill.toLocaleString('en-PH')} average monthly bill and ${lead.interestLevel.toLowerCase()}.`,
        approved: false,
      },
      {
        id: `${id}-ai-2`,
        type: 'follow_up',
        title: 'Sales follow-up draft',
        body: 'Thanks for sharing your bill. We prepared a first-pass solar estimate and can validate the roof/site details before a final proposal.',
        approved: false,
      },
    ],
    events: [{ id: `${id}-event-1`, stage: 'captured', actorRole: 'sales', note: 'Lead captured into intake.', createdAt: '2026-05-20 09:00' }],
  };
}

function uploadedEvidence(surveyJobId: string): SurveyUpload[] {
  return [
    buildSurveyUpload({ surveyJobId, category: 'main_breaker_panel', fileName: 'main-breaker.jpg', storagePath: `${surveyJobId}/main-breaker.jpg`, uploadedByRole: 'installer' }),
    buildSurveyUpload({ surveyJobId, category: 'roof_surface', fileName: 'roof-surface.jpg', storagePath: `${surveyJobId}/roof-surface.jpg`, uploadedByRole: 'installer' }),
    buildSurveyUpload({ surveyJobId, category: 'inverter_location', fileName: 'inverter-location.jpg', storagePath: `${surveyJobId}/inverter-location.jpg`, uploadedByRole: 'installer' }),
    buildSurveyUpload({ surveyJobId, category: 'wire_run_path', fileName: 'wire-run-path.jpg', storagePath: `${surveyJobId}/wire-run-path.jpg`, uploadedByRole: 'installer' }),
  ];
}

function installerValidatedApproval(surveyJobId: string): SurveyApproval {
  return {
    id: `approval-${surveyJobId}`,
    surveyJobId,
    status: 'installer_validated',
    notes: 'Required survey evidence set validated by installer.',
    updatedAt: '2026-05-20 13:00',
  };
}

function ledgerForLead(leadId: string, amount: number): BillingLedgerEvent[] {
  return [
    buildBillingLedgerEvent({ linkedRecordId: leadId, eventType: 'invoice_created', amount, actorRole: 'cs', note: 'Invoice ledger record created from signed contract.' }),
    buildBillingLedgerEvent({ linkedRecordId: leadId, eventType: 'mock_payment_attempt', amount, actorRole: 'cs', note: 'Mock provider payment attempt recorded.' }),
  ];
}

export const seedDeals: Deal[] = [
  baseDeal('lead-001', 'SOL-001', sampleLeadInput),
  {
    ...baseDeal('lead-002', 'SOL-002', { ...sampleLeadInput, businessName: 'Pavia Cold Storage', source: 'Referral', averageMonthlyBill: 72000 }),
    stage: 'survey_assigned',
    preAudit: calculatePreAudit({ ...sampleLeadInput, businessName: 'Pavia Cold Storage', source: 'Referral', averageMonthlyBill: 72000 }),
    score: scoreLead({ ...sampleLeadInput, businessName: 'Pavia Cold Storage', source: 'Referral', averageMonthlyBill: 72000 }),
    surveyJob: {
        id: 'survey-002',
      assignedInstaller: 'Solar Installer Team',
      scheduledAt: '2026-05-23T10:00',
      roofCondition: 'Pending',
      shading: 'Pending',
      usableRoofArea: '',
      mapPin: 'Pavia, Iloilo',
      siteAccessNotes: 'Guard needs visitor names before arrival.',
      photoPlaceholders: ['Main roof plane', 'Service entrance / meter', 'Obstructions / shading'],
      roofStructurallySound: null,
      completed: false,
    },
  },
  {
    ...baseDeal('lead-003', 'SOL-003', { ...sampleLeadInput, businessName: 'Oton Water Station', source: 'QR kiosk', averageMonthlyBill: 26000, businessType: 'Water Station' }),
    stage: 'survey_completed',
    preAudit: calculatePreAudit({ ...sampleLeadInput, businessName: 'Oton Water Station', source: 'QR kiosk', averageMonthlyBill: 26000, businessType: 'Water Station' }),
    score: scoreLead({ ...sampleLeadInput, businessName: 'Oton Water Station', source: 'QR kiosk', averageMonthlyBill: 26000, businessType: 'Water Station' }),
    surveyJob: {
      id: 'survey-003',
      assignedInstaller: 'Solar Installer Team',
      scheduledAt: '2026-05-21T14:00',
      roofCondition: 'Good condition',
      shading: 'Minimal shading',
      usableRoofArea: '72 sqm',
      mapPin: 'Oton, Iloilo',
      siteAccessNotes: 'Access through rear stairs.',
      photoPlaceholders: ['Main roof plane uploaded', 'Meter uploaded', 'Shading uploaded'],
      roofStructurallySound: true,
      completed: true,
    },
    surveyUploads: uploadedEvidence('survey-003'),
    surveyApproval: installerValidatedApproval('survey-003'),
  },
  (() => {
    const deal = {
      ...baseDeal('lead-004', 'SOL-004', { ...sampleLeadInput, businessName: 'City Clinic Lab', source: 'Landing page', averageMonthlyBill: 54000, businessType: 'Clinic / Lab' }),
      stage: 'proposal_ready' as const,
      preAudit: audit,
      score,
      surveyJob: {
        id: 'survey-004',
        assignedInstaller: 'Solar Installer Team',
        scheduledAt: '2026-05-20T13:00',
        roofCondition: 'Minor repair needed' as const,
        shading: 'Moderate shading' as const,
        usableRoofArea: '88 sqm',
        mapPin: 'Iloilo City',
        siteAccessNotes: 'Coordinate with building admin.',
        photoPlaceholders: ['Roof photo uploaded', 'Meter photo uploaded', 'Obstruction photo uploaded'],
        roofStructurallySound: true,
        completed: true,
      },
    };
    const checkoutEstimate = createCheckoutEstimate(deal, { paymentMethod: 'partner_loan', billingAmountType: 'deposit', createdAt: '2026-05-20 13:30' });
    const contract = createContractRecord(deal, checkoutEstimate, 'http://127.0.0.1:5173');
    return {
      ...deal,
      checkoutEstimate: { ...checkoutEstimate, status: 'contract_generated' as const },
      contract,
      surveyUploads: uploadedEvidence('survey-004'),
      surveyApproval: installerValidatedApproval('survey-004'),
      proposal: {
        id: 'proposal-004',
        quoteNumber: 'Q-2026-004',
        systemSizeKwp: audit.sizeKwp,
        projectPrice: checkoutEstimate.total,
        projectedSavings: audit.projectedSavings,
        grossMarginPercent: 28,
        status: 'ready' as const,
      },
    };
  })(),
  (() => {
    const deal = {
      ...baseDeal('lead-005', 'SOL-005', { ...sampleLeadInput, businessName: 'Mandurriao Cafe Group', source: 'Messenger', averageMonthlyBill: 62000, businessType: 'Restaurant / Cafe' }),
      stage: 'cs_review' as const,
      preAudit: audit,
      score,
      surveyJob: {
        id: 'survey-005',
        assignedInstaller: 'Solar Installer Team',
        scheduledAt: '2026-05-19T09:00',
        roofCondition: 'Good condition' as const,
        shading: 'Minimal shading' as const,
        usableRoofArea: '110 sqm',
        mapPin: 'Mandurriao, Iloilo City',
        siteAccessNotes: 'Mall loading bay access before 10am.',
        photoPlaceholders: ['Roof photo uploaded', 'Meter photo uploaded', 'Shading photo uploaded'],
        roofStructurallySound: true,
        completed: true,
      },
    };
    const checkoutEstimate = createCheckoutEstimate(deal, { paymentMethod: 'bank_transfer', billingAmountType: 'milestone', createdAt: '2026-05-19 10:30' });
    const sentContract = createContractRecord(deal, checkoutEstimate, 'http://127.0.0.1:5173');
    const acceptance = {
      id: 'acceptance-contract-lead-005',
      signerName: 'Liza Tan',
      acceptedAt: '2026-05-19 11:15',
      token: sentContract.token,
      contractVersion: sentContract.version,
      paymentMethod: checkoutEstimate.paymentMethod,
      acceptedAmount: checkoutEstimate.billingAmount,
    };
    const contract = { ...sentContract, status: 'signed' as const, signedAt: acceptance.acceptedAt, acceptance };
    const invoice = createAcceptedInvoice(deal, contract, checkoutEstimate);
    const billingTransaction = createMockBillingTransaction(invoice, contract, checkoutEstimate);
    return {
      ...deal,
      checkoutEstimate: { ...checkoutEstimate, status: 'accepted' as const },
      contract,
      proposal: {
        id: 'proposal-005',
        quoteNumber: 'Q-2026-005',
        systemSizeKwp: audit.sizeKwp,
        projectPrice: checkoutEstimate.total,
        projectedSavings: audit.projectedSavings,
        grossMarginPercent: 31,
        status: 'accepted' as const,
      },
      invoice,
      billingTransaction,
      billingLedger: ledgerForLead(deal.id, invoice.amount),
      surveyUploads: uploadedEvidence('survey-005'),
      surveyApproval: installerValidatedApproval('survey-005'),
      financingReview: {
        id: 'fin-005',
        lane: 'partner_loan' as const,
        reviewStatus: 'packet_ready' as const,
        missingDocs: [],
        packetSummary: 'High-score buyer with current bills and complete business documents.',
      },
      documents: {
        electricBills: true,
        businessRegistration: true,
        validId: true,
        locationPin: true,
        roofAccess: true,
      },
      csReady: true,
    };
  })(),
];

export const seedStaff: StaffProfile[] = [
  {
    id: 'staff-owner',
    fullName: 'John Owner',
    email: 'owner@solarops.local',
    role: 'owner',
    active: true,
    focus: 'Approvals, margin review, operating dashboard',
  },
  {
    id: 'staff-manager',
    fullName: 'Mara Manager',
    email: 'manager@solarops.local',
    role: 'manager',
    active: true,
    focus: 'Analytics review, report summaries, operating performance, and escalations',
  },
  {
    id: 'staff-sales',
    fullName: 'Ana Sales',
    email: 'sales@solarops.local',
    role: 'sales',
    active: true,
    focus: 'Lead capture, pre-audit, proposal follow-up',
  },
  {
    id: 'staff-installer',
    fullName: 'Solar Installer Team',
    email: 'installer@solarops.local',
    role: 'installer',
    active: true,
    focus: 'Survey validation, install readiness, site access, and handoff quality',
  },
  {
    id: 'staff-cs',
    fullName: 'Mika CS',
    email: 'cs@solarops.local',
    role: 'cs',
    active: true,
    focus: 'Document readiness, invoice status, customer handoff',
  },
];

export const seedClients: ClientRecord[] = [
  {
    id: 'client-001',
    businessName: 'City Clinic Lab',
    contactName: 'Dr. Ramos',
    location: 'Iloilo City',
    status: 'proposal',
    linkedDealId: 'lead-004',
    commercialValue: audit.capex,
    nextAction: 'CS to confirm deposit timeline and required documents.',
    archiveState: 'active',
  },
  {
    id: 'client-002',
    businessName: 'Mandurriao Cafe Group',
    contactName: 'Liza Tan',
    location: 'Mandurriao, Iloilo City',
    status: 'qualified',
    linkedDealId: 'lead-005',
    commercialValue: audit.capex,
    nextAction: 'Owner review after CS readiness confirmation.',
    archiveState: 'active',
  },
  {
    id: 'client-003',
    businessName: 'Oton Water Station',
    contactName: 'Rico Dela Cruz',
    location: 'Oton, Iloilo',
    status: 'prospect',
    linkedDealId: 'lead-003',
    commercialValue: calculatePreAudit({ ...sampleLeadInput, businessName: 'Oton Water Station', source: 'QR kiosk', averageMonthlyBill: 26000, businessType: 'Water Station' }).capex,
    nextAction: 'Sales to generate proposal from completed survey.',
    archiveState: 'active',
  },
];
