import type { Deal, DealRoom, DealRoomEvent, DealRoomEventType, DealRoomQuoteRequestInput } from '../types';

const PHP = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });

function stamp() {
  return new Date().toLocaleString('en-PH');
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function tokenForDeal(deal: Deal) {
  return `deal-${deal.code.toLowerCase()}-${deal.id.replace(/[^a-z0-9]/gi, '').slice(-8)}`;
}

export function createDealRoom(deal: Deal, origin = 'http://127.0.0.1:5173'): DealRoom {
  const readiness = deal.readinessResult;
  const preAudit = deal.preAudit;
  const systemSize = readiness?.recommendedSystemSizeKwp ?? preAudit?.sizeKwp ?? 0;
  const savingsLow = readiness?.monthlySavingsLow ?? Math.round((preAudit?.projectedSavings ?? 0) * 0.75);
  const savingsHigh = readiness?.monthlySavingsHigh ?? preAudit?.projectedSavings ?? 0;
  const token = tokenForDeal(deal);

  return {
    id: `deal-room-${deal.id}`,
    dealId: deal.id,
    token,
    status: 'active',
    publicUrl: `${origin}/portal/${token}`,
    sections: {
      readinessScore: readiness?.readinessScore ?? deal.score?.score ?? deal.qualification.score,
      recommendedSystemSizeKwp: systemSize,
      savingsRange: `${PHP.format(savingsLow)}-${PHP.format(savingsHigh)} / month`,
      paybackRange: readiness ? `${readiness.paybackYearsLow}-${readiness.paybackYearsHigh} years` : `${preAudit?.paybackYears ?? 0} years`,
      leaseToOwnComparison: readiness?.leaseToOwnComparison ?? `Compare solar payments against current ${PHP.format(deal.lead.averageMonthlyBill)} monthly bill.`,
      netMeteringChecklist: readiness?.netMeteringChecklist ?? ['Utility/provider confirmation', 'Document checklist', 'Installer technical survey'],
      lenderPacketStatus: deal.financingPacket?.status ?? readiness?.lenderPacketStatus ?? 'draft',
      installerReadiness: deal.surveyJob?.completed ? 'Installer validation complete' : 'Installer survey still required',
      valueStory: `${deal.lead.businessName} can review the current solar fit, savings range, payback, financing intent, and net-metering readiness in one shared page.`,
      financingOptions: [
        `Cash baseline: ${PHP.format(deal.checkoutEstimate?.total ?? deal.financingPacket?.installerQuote ?? preAudit?.capex ?? 0)} project value`,
        `Lease-to-own comparison: ${readiness?.leaseToOwnComparison ?? 'Available after readiness intake'}`,
        `Lender packet: ${(deal.financingPacket?.status ?? 'draft').replaceAll('_', ' ')}`,
      ],
    },
    events: [],
    createdAt: stamp(),
  };
}

export function recordDealRoomEvent(room: DealRoom, eventType: DealRoomEventType, metadata: DealRoomEvent['metadata'] = {}): DealRoom {
  const event: DealRoomEvent = {
    id: id('deal-room-event'),
    dealRoomId: room.id,
    eventType,
    metadata,
    createdAt: stamp(),
  };
  return {
    ...room,
    status: eventType === 'paused' ? 'paused' : eventType === 'expired' ? 'expired' : room.status,
    events: [event, ...room.events],
  };
}

export function requestDealRoomQuote(room: DealRoom, input: DealRoomQuoteRequestInput): DealRoom {
  return {
    ...recordDealRoomEvent(room, 'quote_requested', { contactName: input.contactName, phone: input.phone }),
    quoteRequest: {
      status: 'requested',
      input,
      requestedAt: stamp(),
    },
  };
}
