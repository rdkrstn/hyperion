import { makeId, nowIso } from '../../../shared/types/app';
import type { DealRecord } from '../../deals/types';
import type { SolarSnapshot } from '../../solar-snapshot/types';
import type { ClientRecord, InvoiceRecord, PaymentLedgerEvent, ProposalContract, ProposalRecord, ProposalScopeLine } from '../types';

function line(input: Omit<ProposalScopeLine, 'id' | 'total' | 'manuallyEdited'>): ProposalScopeLine {
  return {
    id: makeId('line'),
    total: input.quantity * input.unitPrice,
    manuallyEdited: false,
    ...input,
  };
}

export function createProposalDraft(deal: DealRecord, options: { systemSizeKwp: number; previousProposalId?: string; solarSnapshot?: SolarSnapshot }): ProposalRecord {
  const panelCount = options.solarSnapshot?.selectedPanelCount ?? Math.max(1, Math.ceil(options.systemSizeKwp / 0.58));
  const panelCapacityKw = (options.solarSnapshot?.panelCapacityWatts ?? 580) / 1000;
  const derivedSystemSizeKwp = Number((panelCount * panelCapacityKw).toFixed(2)) || options.systemSizeKwp;
  const systemSizeKwp = options.solarSnapshot?.selectedSystemSizeKwp ?? derivedSystemSizeKwp;
  const lines = [
    line({ category: 'panels', name: 'Tier-1 solar panel array', quantity: panelCount, unit: 'panel', unitPrice: 11059, estimatedCost: panelCount * 7600, marginPercent: 31, sourceReason: 'Sized from Solar Snapshot and lead energy profile.', optional: false }),
    line({ category: 'inverter', name: 'Grid-tie inverter package', quantity: 1, unit: 'lot', unitPrice: Math.round(systemSizeKwp * 14850), estimatedCost: Math.round(systemSizeKwp * 9500), marginPercent: 36, sourceReason: 'Matched to finalized Solar Snapshot kWp.', optional: false }),
    line({ category: 'mounting', name: 'Mounting and roof attachment', quantity: 1, unit: 'lot', unitPrice: Math.round(systemSizeKwp * 7425), estimatedCost: Math.round(systemSizeKwp * 5200), marginPercent: 30, sourceReason: 'Draft from roof capacity and selected panel allocation.', optional: false }),
    line({ category: 'labor', name: 'Installation labor and project management', quantity: 1, unit: 'lot', unitPrice: Math.round(systemSizeKwp * 11550), estimatedCost: Math.round(systemSizeKwp * 7900), marginPercent: 32, sourceReason: 'Labor baseline for selected system size.', optional: false }),
  ];
  const subtotal = lines.reduce((sum, item) => sum + item.total, 0);
  const estimatedCost = lines.reduce((sum, item) => sum + item.estimatedCost, 0);
  const grossMarginPercent = subtotal ? Math.round(((subtotal - estimatedCost) / subtotal) * 100) : 0;
  const createdAt = nowIso();

  return {
    id: makeId('proposal'),
    dealId: deal.id,
    solarSnapshotId: options.solarSnapshot?.id,
    solarSnapshotSummary: options.solarSnapshot ? {
      roofCapacityKwp: options.solarSnapshot.roofCapacityKwp,
      maxPanels: options.solarSnapshot.maxPanels,
      selectedPanelCount: options.solarSnapshot.selectedPanelCount,
      panelCapacityWatts: options.solarSnapshot.panelCapacityWatts,
      selectedSystemSizeKwp: options.solarSnapshot.selectedSystemSizeKwp,
      annualProductionKwh: options.solarSnapshot.annualProductionKwh,
      maxAnnualProductionKwh: options.solarSnapshot.maxAnnualProductionKwh,
      roofAreaM2: options.solarSnapshot.roofAreaM2,
      sunshineHoursPerYear: options.solarSnapshot.sunshineHoursPerYear,
      imageryQuality: options.solarSnapshot.imageryQuality,
    } : undefined,
    revision: options.previousProposalId ? 2 : 1,
    previousProposalId: options.previousProposalId,
    status: grossMarginPercent < 25 ? 'pricing_review_needed' : 'draft',
    isActive: true,
    systemSizeKwp,
    scopeLines: lines,
    subtotal,
    estimatedCost,
    grossMarginPercent,
    paymentOption: deal.commercialPacket.paymentOption,
    createdAt,
    updatedAt: createdAt,
  };
}

export function freezeProposal(proposal: ProposalRecord): ProposalRecord {
  if (proposal.grossMarginPercent < 25 && proposal.status !== 'approved') {
    throw new Error('Pricing approval is required before freezing this proposal.');
  }
  return {
    ...proposal,
    status: 'approved',
    frozenAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function generateContract(proposal: ProposalRecord, deal: DealRecord, origin = 'http://127.0.0.1:5173'): ProposalContract {
  if (!proposal.isActive || !proposal.frozenAt || proposal.status !== 'approved') {
    throw new Error('Only the active frozen proposal can generate a contract.');
  }
  const token = `contract-${proposal.id.replace(/[^a-z0-9]/gi, '').slice(-10)}`;
  return {
    id: makeId('contract'),
    dealId: deal.id,
    proposalId: proposal.id,
    token,
    status: 'sent',
    publicUrl: `${origin}/contracts/${token}`,
    createdAt: nowIso(),
  };
}

export function acceptContract(contract: ProposalContract, proposal: ProposalRecord, deal: DealRecord, signerName: string): {
  contract: ProposalContract;
  proposal: ProposalRecord;
  invoice: InvoiceRecord;
  paymentLedgerEvent: PaymentLedgerEvent;
  client: ClientRecord;
} {
  if (!signerName.trim()) throw new Error('Typed signer name is required.');
  if (!proposal.isActive || !proposal.frozenAt) throw new Error('Only the active frozen proposal can be accepted.');
  if (contract.proposalId !== proposal.id) throw new Error('Contract does not match the active proposal.');
  const signedContract = { ...contract, status: 'signed' as const };
  const invoice: InvoiceRecord = {
    id: makeId('invoice'),
    dealId: deal.id,
    proposalId: proposal.id,
    contractId: contract.id,
    amount: proposal.subtotal,
    status: 'issued',
  };
  const paymentLedgerEvent: PaymentLedgerEvent = {
    id: makeId('payment'),
    invoiceId: invoice.id,
    amount: invoice.amount,
    providerExecution: 'mocked',
    status: 'mock_succeeded',
  };
  const client: ClientRecord = {
    id: makeId('client'),
    dealId: deal.id,
    businessName: deal.leadSnapshot.businessName,
    contactName: deal.leadSnapshot.contactName,
    location: deal.leadSnapshot.location,
    status: 'active_client',
  };
  return {
    contract: signedContract,
    proposal: { ...proposal, status: 'accepted', updatedAt: nowIso() },
    invoice,
    paymentLedgerEvent,
    client,
  };
}
