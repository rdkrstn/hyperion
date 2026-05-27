import {
  calculateBillingAmount,
  calculateEstimateTotal,
  recommendedPaymentMethod,
  standardSolarCatalog,
} from './checkout';
import type {
  BillingAmountType,
  CheckoutEstimate,
  Deal,
  EstimateLineItem,
  PaymentMethod,
  Role,
  SolarCatalogItem,
} from '../types';

const MIN_MARGIN_PERCENT = 25;

function stamp() {
  return new Date().toLocaleString('en-PH');
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function marginPercent(total: number, cost: number) {
  if (total <= 0) return 0;
  return Number((((total - cost) / total) * 100).toFixed(1));
}

function lineTotal(quantity: number, unitPrice: number) {
  return Math.round(Math.max(0, quantity) * Math.max(0, unitPrice));
}

function normalizeLine(line: EstimateLineItem): EstimateLineItem {
  const total = lineTotal(line.quantity, line.unitPrice);
  return {
    ...line,
    total,
    estimatedCost: Math.round(Math.max(0, line.estimatedCost)),
    marginPercent: marginPercent(total, line.estimatedCost),
  };
}

function recalculate(
  estimate: CheckoutEstimate,
  billingAmountType = estimate.billingAmountType,
  customBillingAmount = estimate.billingAmount,
): CheckoutEstimate {
  const lineItems = estimate.lineItems.map(normalizeLine);
  const subtotal = calculateEstimateTotal(lineItems);
  const totalEstimatedCost = lineItems.reduce((sum, item) => sum + item.estimatedCost, 0);
  const grossMarginPercent = marginPercent(subtotal, totalEstimatedCost);
  const approvalStatus = estimate.status === 'frozen' || estimate.status === 'contract_generated' || estimate.status === 'accepted'
    ? estimate.approvalStatus
    : grossMarginPercent < MIN_MARGIN_PERCENT && !estimate.pricingApprovedBy
      ? 'needs_pricing_approval'
      : estimate.pricingApprovedBy
        ? 'approved'
        : 'draft';
  return {
    ...estimate,
    lineItems,
    subtotal,
    total: subtotal,
    totalEstimatedCost,
    grossMarginPercent,
    approvalStatus,
    billingAmountType,
    billingAmount: calculateBillingAmount(subtotal, billingAmountType, customBillingAmount),
  };
}

function sourceReasonFor(item: SolarCatalogItem, deal: Deal) {
  if (item.category === 'panel') {
    const solar = deal.solarInsights?.maxSystemSizeKwp
      ? `Solar API roof capacity ${deal.solarInsights.maxSystemSizeKwp} kWp`
      : 'Solar API pending/manual review';
    return `${solar}; pre-audit recommendation ${deal.preAudit?.sizeKwp ?? deal.readinessResult?.recommendedSystemSizeKwp ?? 'pending'} kWp.`;
  }
  if (item.category === 'mounting') return 'Scope suggested from roof type, survey readiness, and Solar API roof review.';
  if (item.category === 'permit') return 'Required for net-metering and compliance document workflow.';
  return 'Scope suggested from pre-audit package and standard solar delivery model.';
}

function buildDraftLine(item: SolarCatalogItem, deal: Deal, targetTotal: number, runningTotal: number, isLast: boolean): EstimateLineItem {
  const total = isLast ? targetTotal - runningTotal : Math.round(targetTotal * item.defaultShare);
  const quantity = item.category === 'panel' ? Math.max(1, Math.ceil((deal.preAudit?.sizeKwp ?? deal.readinessResult?.recommendedSystemSizeKwp ?? 1) / 0.58)) : 1;
  const estimatedCost = Math.round(total * (item.category === 'labor' ? 0.62 : item.category === 'permit' ? 0.5 : 0.7));
  return normalizeLine({
    id: `line-${item.id}`,
    catalogItemId: item.id,
    category: item.category,
    name: item.name,
    description: item.description,
    quantity,
    unit: item.unit,
    unitPrice: Math.round(total / quantity),
    estimatedCost,
    marginPercent: 0,
    total,
    optional: item.optional,
    source: item.category === 'panel' || item.category === 'mounting' ? 'solar_api' : item.category === 'permit' ? 'catalog' : 'pre_audit',
    sourceReason: sourceReasonFor(item, deal),
    notes: '',
    manuallyEdited: false,
  });
}

export function createQuoteDraft(
  deal: Deal,
  options: {
    paymentMethod?: PaymentMethod;
    billingAmountType?: BillingAmountType;
    customBillingAmount?: number;
    createdAt?: string;
  } = {},
): CheckoutEstimate {
  if (!deal.preAudit) throw new Error('Pre-audit is required before quote draft.');
  const targetTotal = Math.round(deal.preAudit.capex);
  let runningTotal = 0;
  const lineItems = standardSolarCatalog.map((item, index) => {
    const line = buildDraftLine(item, deal, targetTotal, runningTotal, index === standardSolarCatalog.length - 1);
    runningTotal += line.total;
    return line;
  });
  return recalculate({
    id: `estimate-${deal.id}`,
    dealId: deal.id,
    status: 'draft',
    lineItems,
    subtotal: 0,
    grossMarginPercent: 0,
    total: 0,
    totalEstimatedCost: 0,
    approvalStatus: 'draft',
    paymentMethod: options.paymentMethod ?? recommendedPaymentMethod(deal.score?.lane),
    billingAmountType: options.billingAmountType ?? 'deposit',
    billingAmount: 0,
    createdAt: options.createdAt ?? stamp(),
  }, options.billingAmountType ?? 'deposit', options.customBillingAmount ?? 0);
}

export function updateQuoteLine(estimate: CheckoutEstimate, lineId: string, patch: Partial<Pick<EstimateLineItem, 'name' | 'description' | 'quantity' | 'unit' | 'unitPrice' | 'estimatedCost' | 'notes' | 'optional'>>): CheckoutEstimate {
  const lineItems = estimate.lineItems.map((line) => (
    line.id === lineId
      ? normalizeLine({ ...line, ...patch, manuallyEdited: true, source: 'manual', sourceReason: patch.notes || line.sourceReason })
      : line
  ));
  return recalculate({ ...estimate, lineItems, status: estimate.status === 'frozen' ? 'draft' : estimate.status, frozenAt: undefined });
}

export function addQuoteLine(estimate: CheckoutEstimate, input: Omit<EstimateLineItem, 'id' | 'catalogItemId' | 'total' | 'marginPercent' | 'source' | 'manuallyEdited'> & { catalogItemId?: string }): CheckoutEstimate {
  const line = normalizeLine({
    ...input,
    id: id('line'),
    catalogItemId: input.catalogItemId ?? 'manual',
    source: 'manual',
    manuallyEdited: true,
    marginPercent: 0,
    total: 0,
  });
  return recalculate({ ...estimate, lineItems: [...estimate.lineItems, line], status: estimate.status === 'frozen' ? 'draft' : estimate.status, frozenAt: undefined });
}

export function removeQuoteLine(estimate: CheckoutEstimate, lineId: string): CheckoutEstimate {
  return recalculate({ ...estimate, lineItems: estimate.lineItems.filter((line) => line.id !== lineId), status: estimate.status === 'frozen' ? 'draft' : estimate.status, frozenAt: undefined });
}

export function approvePricing(estimate: CheckoutEstimate, actorRole: Role, note: string): CheckoutEstimate {
  if (actorRole !== 'owner' && actorRole !== 'manager') throw new Error('Only owner or manager can approve quote pricing.');
  if (!note.trim()) throw new Error('Pricing approval note is required.');
  return recalculate({
    ...estimate,
    approvalStatus: 'approved',
    pricingApprovedBy: actorRole,
    pricingApprovedAt: stamp(),
    pricingApprovalNote: note.trim(),
  });
}

export function freezeCheckoutEstimate(estimate: CheckoutEstimate, actorRole: Role): CheckoutEstimate {
  if (!['sales', 'owner', 'manager'].includes(actorRole)) throw new Error('Only sales, owner, or manager can freeze checkout estimates.');
  const recalculated = recalculate(estimate);
  if (recalculated.approvalStatus === 'needs_pricing_approval') throw new Error('Quote needs pricing approval before contract generation.');
  return {
    ...recalculated,
    status: 'frozen',
    approvalStatus: recalculated.pricingApprovedBy ? 'approved' : 'frozen',
    frozenAt: stamp(),
  };
}
