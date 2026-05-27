import { laneLabel } from './scoring';
import type {
  BillingAmountType,
  BillingTransaction,
  CheckoutEstimate,
  ContractRecord,
  Deal,
  EstimateLineItem,
  FinancingLane,
  InvoiceRecord,
  PaymentMethod,
  PreAuditSnapshot,
  SolarCatalogItem,
} from '../types';

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  gcash_maya: 'GCash / Maya',
  card: 'Card',
  partner_loan: 'Partner loan',
  rent_to_own: 'Rent-to-own',
};

export const billingAmountLabels: Record<BillingAmountType, string> = {
  deposit: 'Deposit',
  milestone: 'Milestone',
  custom: 'Custom',
  full: 'Full project',
};

export const standardSolarCatalog: SolarCatalogItem[] = [
  {
    id: 'panel-array',
    category: 'panel',
    name: 'Tier-1 solar panel array',
    description: 'PV modules sized from the completed survey and pre-audit output.',
    unit: 'system',
    defaultShare: 0.35,
    optional: false,
  },
  {
    id: 'hybrid-inverter',
    category: 'inverter',
    name: 'Grid-tie inverter package',
    description: 'Inverter, protection interfaces, commissioning setup, and monitoring readiness.',
    unit: 'system',
    defaultShare: 0.18,
    optional: false,
  },
  {
    id: 'mounting-rails',
    category: 'mounting',
    name: 'Mounting and roof attachment',
    description: 'Rails, clamps, sealants, and roof attachment materials.',
    unit: 'lot',
    defaultShare: 0.09,
    optional: false,
  },
  {
    id: 'electrical-bos',
    category: 'electrical',
    name: 'Electrical BOS and protection',
    description: 'DC/AC protection, cable runs, isolators, breakers, and labeling.',
    unit: 'lot',
    defaultShare: 0.12,
    optional: false,
  },
  {
    id: 'permits-metering',
    category: 'permit',
    name: 'Permits and metering support',
    description: 'Documentation support for permit and metering coordination.',
    unit: 'lot',
    defaultShare: 0.04,
    optional: false,
  },
  {
    id: 'installation-labor',
    category: 'labor',
    name: 'Installation labor and project management',
    description: 'Field labor, safety setup, logistics, testing, and turnover coordination.',
    unit: 'lot',
    defaultShare: 0.14,
    optional: false,
  },
  {
    id: 'monitoring-turnover',
    category: 'adder',
    name: 'Monitoring and owner turnover',
    description: 'Monitoring walkthrough, operating guide, and post-install handoff.',
    unit: 'lot',
    defaultShare: 0.08,
    optional: true,
  },
];

export function clampBillingAmount(total: number, amount: number) {
  return Math.min(Math.max(Math.round(amount), 0), Math.round(total));
}

export function calculateBillingAmount(total: number, type: BillingAmountType, customAmount = 0) {
  if (type === 'deposit') return clampBillingAmount(total, total * 0.2);
  if (type === 'milestone') return clampBillingAmount(total, total * 0.5);
  if (type === 'full') return clampBillingAmount(total, total);
  return clampBillingAmount(total, customAmount);
}

export function buildEstimateLineItems(preAudit: PreAuditSnapshot, catalog = standardSolarCatalog): EstimateLineItem[] {
  const targetTotal = Math.round(preAudit.capex);
  let runningTotal = 0;

  return catalog.map((item, index) => {
    const isLast = index === catalog.length - 1;
    const total = isLast ? targetTotal - runningTotal : Math.round(targetTotal * item.defaultShare);
    runningTotal += total;
    const quantity = item.category === 'panel' ? Math.max(1, Math.ceil(preAudit.sizeKwp / 0.58)) : 1;
    const estimatedCost = Math.round(total * (item.category === 'labor' ? 0.62 : item.category === 'permit' ? 0.5 : 0.7));
    return {
      id: `line-${item.id}`,
      catalogItemId: item.id,
      category: item.category,
      name: item.name,
      description: item.description,
      quantity,
      unit: item.unit,
      unitPrice: Math.round(total / quantity),
      estimatedCost,
      marginPercent: total > 0 ? Number((((total - estimatedCost) / total) * 100).toFixed(1)) : 0,
      total,
      optional: item.optional,
      source: item.category === 'panel' || item.category === 'mounting' ? 'solar_api' : item.category === 'permit' ? 'catalog' : 'pre_audit',
      sourceReason: item.category === 'panel'
        ? `Solar API/pre-audit scope basis for ${preAudit.sizeKwp} kWp recommendation.`
        : item.category === 'permit'
          ? 'Required for net-metering and compliance workflow.'
          : 'Suggested from standard solar delivery scope.',
      notes: '',
      manuallyEdited: false,
    };
  });
}

export function calculateEstimateTotal(lineItems: Pick<EstimateLineItem, 'total'>[]) {
  return lineItems.reduce((sum, item) => sum + item.total, 0);
}

export function createCheckoutEstimate(
  deal: Deal,
  options: {
    paymentMethod?: PaymentMethod;
    billingAmountType?: BillingAmountType;
    customBillingAmount?: number;
    createdAt?: string;
  } = {},
): CheckoutEstimate {
  if (!deal.preAudit) throw new Error('Pre-audit is required before checkout.');
  const lineItems = buildEstimateLineItems(deal.preAudit);
  const subtotal = calculateEstimateTotal(lineItems);
  const totalEstimatedCost = lineItems.reduce((sum, item) => sum + item.estimatedCost, 0);
  const grossMarginPercent = subtotal > 0 ? Number((((subtotal - totalEstimatedCost) / subtotal) * 100).toFixed(1)) : 0;
  const paymentMethod = options.paymentMethod ?? recommendedPaymentMethod(deal.score?.lane);
  const billingAmountType = options.billingAmountType ?? 'deposit';
  return {
    id: `estimate-${deal.id}`,
    dealId: deal.id,
    status: 'draft',
    lineItems,
    subtotal,
    grossMarginPercent,
    total: subtotal,
    totalEstimatedCost,
    approvalStatus: grossMarginPercent < 25 ? 'needs_pricing_approval' : 'draft',
    paymentMethod,
    billingAmountType,
    billingAmount: calculateBillingAmount(subtotal, billingAmountType, options.customBillingAmount),
    createdAt: options.createdAt ?? new Date().toLocaleString('en-PH'),
  };
}

export function updateEstimateBilling(
  estimate: CheckoutEstimate,
  paymentMethod: PaymentMethod,
  billingAmountType: BillingAmountType,
  customBillingAmount = estimate.billingAmount,
): CheckoutEstimate {
  return {
    ...estimate,
    paymentMethod,
    billingAmountType,
    billingAmount: calculateBillingAmount(estimate.total, billingAmountType, customBillingAmount),
  };
}

export function recommendedPaymentMethod(lane: FinancingLane | undefined): PaymentMethod {
  if (lane === 'partner_loan') return 'partner_loan';
  if (lane === 'rent_to_own') return 'rent_to_own';
  if (lane === 'cash') return 'bank_transfer';
  return 'gcash_maya';
}

export function contractTermsForLane(lane: FinancingLane, estimate: CheckoutEstimate) {
  const shared = [
    `System package value is ${formatPeso(estimate.total)} based on the current surveyed scope and estimate lines.`,
    `The first billing request is ${formatPeso(estimate.billingAmount)} via ${paymentMethodLabels[estimate.paymentMethod]}.`,
    'Final installation schedule remains subject to document readiness, site access, and owner approval.',
  ];

  const laneTerms: Record<FinancingLane, string[]> = {
    cash: ['Cash lane: client proceeds through direct settlement based on the agreed invoice schedule.'],
    rent_to_own: ['Rent-to-own lane: client acceptance confirms intent to proceed with the internal RTO review packet and downpayment schedule.'],
    partner_loan: ['Partner-loan lane: client acceptance confirms intent to proceed subject to partner financing review and document completion.'],
    starter: ['Starter lane: package scope may be staged and expanded after initial operating results are reviewed.'],
    nurture: ['Nurture lane: contract should not be sent until the deal is re-qualified by sales.'],
  };

  return [...shared, ...laneTerms[lane]];
}

export function createContractRecord(deal: Deal, estimate: CheckoutEstimate, origin = 'http://127.0.0.1:5173'): ContractRecord {
  const lane = deal.score?.lane ?? 'nurture';
  const token = `contract-${deal.code.toLowerCase()}-${estimate.id.replace(/[^a-z0-9]/gi, '').slice(-8)}`;
  return {
    id: `contract-${deal.id}`,
    dealId: deal.id,
    estimateId: estimate.id,
    token,
    version: 'solar-v1',
    lane,
    status: 'sent',
    templateTitle: `${laneLabel(lane)} solar installation agreement`,
    terms: contractTermsForLane(lane, estimate),
    publicUrl: `${origin}/contracts/${token}`,
    createdAt: new Date().toLocaleString('en-PH'),
  };
}

export function createAcceptedInvoice(deal: Deal, contract: ContractRecord, estimate: CheckoutEstimate): InvoiceRecord {
  return {
    id: `invoice-${deal.id}`,
    invoiceNumber: `INV-${new Date().getFullYear()}-${deal.code.slice(-3)}`,
    amount: estimate.billingAmount,
    paymentStatus: 'deposit_pending',
    receiptReference: '',
    contractId: contract.id,
    paymentMethod: estimate.paymentMethod,
    billingAmount: estimate.billingAmount,
    billingStatus: 'mock_succeeded',
  };
}

export function createMockBillingTransaction(invoice: InvoiceRecord, contract: ContractRecord, estimate: CheckoutEstimate): BillingTransaction {
  return {
    id: `bill-${contract.id}`,
    invoiceId: invoice.id,
    contractId: contract.id,
    provider: 'mock',
    paymentMethod: estimate.paymentMethod,
    amount: estimate.billingAmount,
    status: 'mock_succeeded',
    reference: `MOCK-${contract.token.toUpperCase()}`,
    createdAt: new Date().toLocaleString('en-PH'),
  };
}

function formatPeso(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount);
}
