import type {
  BudgetPreference,
  ClientRecord,
  Deal,
  FinancingPacket,
  FinancingPacketStatus,
  InstallerScorecard,
  LeadInput,
  NetMeteringWorkflow,
  ReadinessIntake,
  ReadinessResult,
  ReadinessUpload,
  ReadinessUploadCategory,
  RiskLevel,
  RoofOwnership,
  StaffProfile,
} from '../types';

const PHP = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });

function stamp() {
  return new Date().toLocaleString('en-PH');
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export const emptyRuntimeState = {
  deals: [] as Deal[],
  clients: [] as ClientRecord[],
  staff: [] as StaffProfile[],
};

export const sampleReadinessIntake: ReadinessIntake = {
  businessName: 'Iloilo Fresh Laundry',
  contactName: 'Maria Santos',
  location: 'Mandurriao, Iloilo City',
  utilityProvider: 'MORE Power',
  businessType: 'Laundry',
  monthlyElectricityBill: 48000,
  operatingHours: '7am-7pm',
  daytimeUsageLevel: 'high',
  roofOwnership: 'owned',
  roofType: 'concrete',
  budgetPreference: 'lease_to_own',
  batteryInterest: false,
  groupBuyInterest: true,
  billUploadFileName: 'latest-bill.pdf',
  internalNotes: '',
  assignedSales: '',
};

export const blankReadinessIntake: ReadinessIntake = {
  businessName: '',
  contactName: '',
  location: '',
  utilityProvider: '',
  businessType: 'Retail / sari-sari',
  monthlyElectricityBill: 0,
  operatingHours: '8am-5pm',
  daytimeUsageLevel: 'medium',
  roofOwnership: 'owned',
  roofType: 'metal',
  budgetPreference: 'lease_to_own',
  batteryInterest: false,
  groupBuyInterest: false,
  billUploadFileName: '',
  internalNotes: '',
  assignedSales: '',
  locationConfidence: 'fallback',
};

export function readinessToLeadInput(input: ReadinessIntake): LeadInput {
  return {
    source: 'Landing page',
    businessName: input.businessName,
    contactName: input.contactName,
    location: input.location,
    businessType: input.businessType,
    averageMonthlyBill: input.monthlyElectricityBill,
    tariff: 11,
    productionPerKwp: 110,
    pricePerKwp: 55000,
    propertyControl: input.roofOwnership === 'owned' ? 'Owns property' : input.roofOwnership === 'rented_with_authorization' ? 'Leases with owner authorization' : 'Rents / no authorization yet',
    yearsInBusiness: '2-5 years',
    revenueBand: input.monthlyElectricityBill >= 50000 ? '\u20b1150k-\u20b1500k / month' : 'Prefer not to say',
    paymentBehavior: 'Unknown',
    purchaseTimeline: input.budgetPreference === 'cash' ? '0-30 days' : '1-3 months',
    interestLevel: 'Ready for site survey',
    preferredSurveySlot: '',
    staffNotes: input.internalNotes ?? 'Created from Solar Readiness Intake.',
  };
}

function roofScore(ownership: RoofOwnership) {
  if (ownership === 'owned') return 18;
  if (ownership === 'rented_with_authorization') return 12;
  return 4;
}

function budgetScore(preference: BudgetPreference) {
  if (preference === 'cash') return 18;
  if (preference === 'lease_to_own' || preference === 'loan') return 14;
  return 10;
}

function billRange(monthlyBill: number) {
  if (monthlyBill >= 70000) return 'PHP 70k+ / month';
  if (monthlyBill >= 35000) return 'PHP 35k-70k / month';
  if (monthlyBill >= 15000) return 'PHP 15k-35k / month';
  return 'Below PHP 15k / month';
}

function riskLevel(score: number, ownership: RoofOwnership): RiskLevel {
  if (ownership === 'rented_needs_authorization' || score < 45) return 'high';
  if (score < 70) return 'medium';
  return 'low';
}

export function calculateReadinessResult(input: ReadinessIntake): ReadinessResult {
  const bill = Math.max(0, input.monthlyElectricityBill);
  const billPoints = bill >= 35000 ? 22 : bill >= 15000 ? 14 : 7;
  const usagePoints = input.daytimeUsageLevel === 'high' ? 18 : input.daytimeUsageLevel === 'medium' ? 12 : 6;
  const roofPoints = roofScore(input.roofOwnership);
  const budgetPoints = budgetScore(input.budgetPreference);
  const filesPoints = input.billUploadFileName ? 10 : 0;
  const score = Math.min(100, billPoints + usagePoints + roofPoints + budgetPoints + filesPoints + 14);
  const monthlyKwh = bill / 11;
  const sizeKwp = Math.max(2, Math.round((monthlyKwh * 0.65) / 110));
  const monthlySavingsLow = Math.round(bill * 0.28);
  const monthlySavingsHigh = Math.round(bill * 0.48);
  const capex = sizeKwp * 55000;
  const yearlySavingsLow = monthlySavingsLow * 12;
  const yearlySavingsHigh = monthlySavingsHigh * 12;
  const paybackYearsLow = Number((capex / Math.max(yearlySavingsHigh, 1)).toFixed(1));
  const paybackYearsHigh = Number((capex / Math.max(yearlySavingsLow, 1)).toFixed(1));
  const missingDocuments = [
    !input.billUploadFileName ? 'Customer bill upload' : '',
    input.roofOwnership === 'rented_needs_authorization' ? 'Owner authorization' : '',
  ].filter(Boolean);
  const risk = riskLevel(score, input.roofOwnership);
  const installerScorecard: InstallerScorecard = {
    leadScore: score,
    billRange: billRange(bill),
    roofReadiness: input.roofOwnership === 'owned' ? `${input.roofType} roof / ownership confirmed` : `${input.roofType} roof / authorization review needed`,
    financingIntent: input.budgetPreference.replaceAll('_', ' '),
    missingDocuments,
    estimatedProjectValue: capex,
    riskLevel: risk,
    nextBestAction: score >= 70 ? 'Prioritize installer survey and lender packet completion.' : 'Keep qualifying before installer dispatch.',
  };

  return {
    id: id('readiness'),
    readinessScore: score,
    recommendedSystemSizeKwp: sizeKwp,
    monthlySavingsLow,
    monthlySavingsHigh,
    paybackYearsLow,
    paybackYearsHigh,
    leaseToOwnComparison: input.budgetPreference === 'lease_to_own'
      ? `Compare lease-to-own payment against current ${PHP.format(bill)} monthly bill.`
      : `Current bill baseline is ${PHP.format(bill)} per month.`,
    netMeteringChecklist: ['Utility/provider confirmation', 'Proof of ownership or authorization', 'Installer technical survey', 'DU/LGU application package', 'Bi-directional meter follow-up'],
    installerSurveyPriority: score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low',
    lenderPacketStatus: missingDocuments.length ? 'missing_requirements' : 'ready_for_lender',
    cooperativeOption: input.groupBuyInterest ? 'Eligible for cooperative aggregation / group-buy interest list.' : 'No group-buy interest captured.',
    installerScorecard,
    createdAt: stamp(),
  };
}

export function buildReadinessUploads(leadId: string, input: ReadinessIntake): ReadinessUpload[] {
  const uploads: Array<{ category: ReadinessUploadCategory; fileName?: string }> = [
    { category: 'bill', fileName: input.billUploadFileName },
  ];
  return uploads
    .filter((upload): upload is { category: ReadinessUploadCategory; fileName: string } => Boolean(upload.fileName))
    .map((upload) => ({
      id: id('readiness-upload'),
      leadId,
      category: upload.category,
      fileName: upload.fileName,
      storagePath: `${leadId}/readiness/${upload.category}/${upload.fileName}`,
      uploadedAt: stamp(),
    }));
}

export function buildNetMeteringWorkflow(input: ReadinessIntake, systemSizeKwp = 0): NetMeteringWorkflow {
  const likelyEligible = input.roofOwnership !== 'rented_needs_authorization';
  const now = stamp();
  return {
    id: id('net-metering'),
    status: 'documents_pending',
    utilityProvider: input.utilityProvider,
    location: input.location,
    ownershipFlag: input.roofOwnership,
    systemSizeKwp,
    createdAt: now,
    steps: [
      {
        id: 'eligibility',
        status: likelyEligible ? 'in_progress' : 'blocked',
        customerLabel: likelyEligible ? 'Likely eligible / needs utility review' : 'Needs ownership authorization review',
        adminLabel: `${input.utilityProvider}, ${systemSizeKwp || 'pending'} kWp, ownership flag: ${input.roofOwnership}`,
        missingItems: likelyEligible ? [] : ['Owner authorization'],
        updatedAt: now,
      },
      { id: 'documents', status: 'not_started', customerLabel: 'Document checklist', adminLabel: 'Missing docs tracker', missingItems: ['Latest bill', 'Valid ID/business docs', 'Title/lease or site-control proof'], updatedAt: now },
      { id: 'technical_review', status: 'not_started', customerLabel: 'Installer survey needed', adminLabel: 'Engineering task', missingItems: ['Installer survey validation'], updatedAt: now },
      { id: 'application', status: 'not_started', customerLabel: 'Prepared for submission', adminLabel: 'DU/LGU submission status', missingItems: ['Signed application package'], updatedAt: now },
      { id: 'metering', status: 'not_started', customerLabel: 'Bi-directional meter pending', adminLabel: 'Timeline and follow-up', missingItems: ['Metering schedule'], updatedAt: now },
      { id: 'active_credits', status: 'not_started', customerLabel: 'Track exported energy credits', adminLabel: 'Monitoring and support task', missingItems: ['Post-activation monitoring'], updatedAt: now },
    ],
  };
}

export function buildFinancingPacket(input: ReadinessIntake, result: ReadinessResult): FinancingPacket {
  const missingRequirements = [
    !input.billUploadFileName ? 'Customer bill upload' : '',
    input.roofOwnership === 'rented_needs_authorization' ? 'Owner authorization' : '',
  ].filter(Boolean);
  const status: FinancingPacketStatus = missingRequirements.length ? 'missing_requirements' : 'ready_for_lender';
  const riskFlags = [
    'Net-metering still requires utility confirmation.',
    ...missingRequirements.map((item) => `Missing: ${item}`),
    result.installerScorecard.riskLevel === 'high' ? 'High readiness risk before lender review.' : '',
  ].filter(Boolean);

  return {
    id: id('packet'),
    status,
    billSummary12Month: `${PHP.format(input.monthlyElectricityBill)} average monthly bill captured from readiness intake.`,
    estimatedSystemSizeKwp: result.recommendedSystemSizeKwp,
    estimatedSavingsRange: `${PHP.format(result.monthlySavingsLow)}-${PHP.format(result.monthlySavingsHigh)} / month`,
    paybackRange: `${result.paybackYearsLow}-${result.paybackYearsHigh} years`,
    affordabilityProfile: `${input.budgetPreference.replaceAll('_', ' ')} preference against ${PHP.format(input.monthlyElectricityBill)} monthly bill.`,
    siteReadinessScore: result.readinessScore,
    installerQuote: result.installerScorecard.estimatedProjectValue,
    netMeteringStatus: result.netMeteringChecklist[0],
    riskFlags,
    missingRequirements,
    createdAt: stamp(),
  };
}

export function canRemoveLead(input: { stage: Deal['stage']; hasOperationalRecords: boolean }) {
  if (input.stage === 'captured' && !input.hasOperationalRecords) {
    return { allowed: true, reason: 'Untouched captured lead can be removed.' };
  }
  return { allowed: false, reason: 'Operational history exists. Archive or cancel instead of hard deleting.' };
}
