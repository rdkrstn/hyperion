import type { DealRecord } from '../../deals/types';
import type { NetMeteringWorkflowStepView } from '../../net-metering/types';
import type { CustomerType } from '../../leads/types';
import type { ProposalRecord } from '../types';

export interface ProposalPresentationItem {
  title: string;
  detail: string;
  value?: string;
}

export interface ProposalPresentation {
  preparedFor: {
    customerName: string;
    contactName: string;
    propertyAddress: string;
    reference: string;
  };
  system: {
    title: string;
    systemSizeKwp: number;
    panelCount: number;
    annualProductionKwh: number;
    monthlyProductionKwh: number;
    monthlySavings: number;
    paybackYears: number;
  };
  useCaseSection: {
    kind: 'residential' | 'commercial';
    items: ProposalPresentationItem[];
  };
  inclusions: ProposalPresentationItem[];
  exclusions: ProposalPresentationItem[];
  warranty: ProposalPresentationItem[];
  timeline: ProposalPresentationItem[];
  terms: string[];
  netMeteringSteps: NetMeteringWorkflowStepView[];
}

const phpPerKwh = 11;

export function buildProposalPresentation(input: {
  deal: DealRecord;
  proposal: ProposalRecord;
  customerType?: CustomerType;
  netMeteringSteps: NetMeteringWorkflowStepView[];
}): ProposalPresentation {
  const summary = input.proposal.solarSnapshotSummary;
  const annualProductionKwh = Math.round(summary?.annualProductionKwh ?? input.proposal.systemSizeKwp * 1314);
  const monthlyProductionKwh = Math.round(annualProductionKwh / 12);
  const monthlySavings = Math.round(monthlyProductionKwh * phpPerKwh);
  const paybackYears = input.proposal.subtotal && monthlySavings
    ? Number((input.proposal.subtotal / (monthlySavings * 12)).toFixed(1))
    : 0;
  const panelCount = summary?.selectedPanelCount ?? Math.max(1, Math.round(input.proposal.systemSizeKwp / 0.58));
  const kind = input.customerType === 'residential' ? 'residential' : 'commercial';

  return {
    preparedFor: {
      customerName: input.deal.leadSnapshot.businessName,
      contactName: input.deal.leadSnapshot.contactName,
      propertyAddress: input.deal.leadSnapshot.location,
      reference: `${input.proposal.id.toUpperCase()}-R${input.proposal.revision}`,
    },
    system: {
      title: `${input.proposal.systemSizeKwp.toFixed(2)} kWp Grid-Tied Solar PV System`,
      systemSizeKwp: input.proposal.systemSizeKwp,
      panelCount,
      annualProductionKwh,
      monthlyProductionKwh,
      monthlySavings,
      paybackYears,
    },
    useCaseSection: kind === 'residential'
      ? {
        kind,
        items: [
          { title: 'Inverter Aircon 1.5HP', detail: '900W · 8 hrs/day', value: '7.2 kWh/day' },
          { title: 'Refrigerator 2-door', detail: '100W avg · 24 hrs', value: '2.4 kWh/day' },
          { title: 'LED Lights x20', detail: '8W · 8 hrs/day', value: '1.28 kWh/day' },
          { title: 'Laptops x3 + WiFi', detail: '190W · 8 hrs/day', value: '1.52 kWh/day' },
        ],
      }
      : {
        kind,
        items: [
          { title: 'Business continuity', detail: 'Reduce exposure to bill spikes and brownout disruption.' },
          { title: 'Financing readiness', detail: 'Proposal includes bill, site, solar, survey, and net-metering status for lender review.' },
          { title: 'Operating-cost control', detail: 'Monthly savings estimate supports payback and affordability review.' },
          { title: 'Customer trust', detail: 'Client portal, documents, survey schedule, and contract status stay visible.' },
        ],
      },
    inclusions: [
      { title: 'Solar PV Panels', detail: `${panelCount} panels sized from finalized Solar Snapshot layout.` },
      { title: 'Grid-Tied Inverter', detail: 'Matched to approved proposal system size.' },
      { title: 'Aluminum Mounting System', detail: 'Rails, clamps, and roof attachments for validated roof condition.' },
      { title: 'DC/AC Wiring and Protection', detail: 'Conduit, breakers, isolators, grounding, and labeling.' },
      { title: 'Installation Labor', detail: 'Site installation, testing, commissioning, and turnover.' },
    ],
    exclusions: [
      { title: 'Major civil works / roof repairs', detail: 'Quoted only if installer survey flags remediation.' },
      { title: 'Main electrical panel upgrade', detail: 'Additional if final technical review requires it.' },
      { title: 'Tree trimming / obstruction removal', detail: 'Additional if shading or access blockers are confirmed.' },
    ],
    warranty: [
      { title: 'Solar panels', detail: '10 years product', value: '25 years performance' },
      { title: 'Inverter', detail: '5 years product warranty' },
      { title: 'Mounting system', detail: '10 years product warranty' },
      { title: 'Workmanship / installation', detail: '1 year workmanship warranty' },
    ],
    timeline: [
      { title: 'Site survey & confirmation', detail: 'Roof inspection, electrical check, and layout confirmation.', value: '1-3 days' },
      { title: 'Order processing', detail: 'Equipment ordering, procurement, and delivery scheduling.', value: '1-2 weeks' },
      { title: 'Installation', detail: 'Panel mounting, inverter installation, DC/AC wiring, and testing.', value: '1-3 days' },
      { title: 'Turn-over & net-metering', detail: 'Commissioning, client orientation, and DU/LGU coordination.', value: '1-2 days' },
    ],
    terms: [
      'This proposal is valid for 30 days from the issue date.',
      'Payment terms are subject to selected payment option and final approval.',
      'Prices are based on current supplier rates and may adjust for major market changes before acceptance.',
      'Estimated savings depend on actual weather, exported energy credits, and customer usage patterns.',
      'Major civil works, roof repairs, and panel upgrades are excluded unless explicitly stated.',
    ],
    netMeteringSteps: input.netMeteringSteps,
  };
}
