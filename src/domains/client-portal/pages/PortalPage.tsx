import { useParams } from 'react-router-dom';
import { useSolarOps } from '../../../shared/api/SolarOpsProvider';
import { EmptyState, Info, PageHeader, Panel } from '../../../shared/ui/primitives';
import { php, titleize } from '../../../shared/utils/format';
import { buildNetMeteringWorkflowView } from '../../net-metering/services/netMeteringWorkflowService';
import { NetMeteringWorkflowPanel } from '../../net-metering/components/NetMeteringWorkflowPanel';

export function PortalPage() {
  const { token = '' } = useParams();
  const { state } = useSolarOps();
  const portal = state.clientPortals.find((item) => item.token === token);
  const deal = portal ? state.deals.find((item) => item.id === portal.dealId) : undefined;
  const proposal = deal ? state.proposals.find((item) => item.dealId === deal.id && item.isActive) : undefined;
  const solar = deal ? state.solarSnapshots.find((item) => item.dealId === deal.id || item.leadId === deal.leadId) : undefined;
  const lead = deal ? state.leads.find((item) => item.id === deal.leadId) : undefined;
  const documents = deal ? state.documents.filter((item) => item.dealId === deal.id || item.leadId === deal.leadId) : [];
  const surveys = deal ? state.surveys.filter((item) => item.dealId === deal.id) : [];
  const netMeteringView = deal ? buildNetMeteringWorkflowView({
    deal,
    documents,
    surveys,
    utilityProvider: lead?.siteProfile.utilityProvider,
  }) : undefined;

  if (!portal || !deal) return <div className="min-h-screen bg-background p-4"><EmptyState text="Client Portal link is unavailable or expired." /></div>;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader title="My Solar Fit" description={deal.leadSnapshot.businessName} />
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Solar fit">
            <div className="grid gap-3">
              <Info label="Readiness score" value={`${deal.leadSnapshot.readinessScore}/100`} />
              <Info label="Recommended roof capacity" value={solar ? `${solar.roofCapacityKwp} kWp` : 'Pending'} />
              <Info label="Estimated production" value={solar ? `${solar.annualProductionKwh.toLocaleString()} kWh/year` : 'Pending'} />
            </div>
          </Panel>
          <Panel title="Proposal">
            <div className="grid gap-3">
              <Info label="Status" value={proposal ? titleize(proposal.status) : 'Pending'} />
              <Info label="Estimated price" value={proposal ? php.format(proposal.subtotal) : 'Pending'} />
              <Info label="Payment options" value={deal.commercialPacket.paymentOption} />
            </div>
          </Panel>
        </div>
        <Panel title="Next steps">
          <div className="grid gap-3 md:grid-cols-4">
            {['Upload Documents', 'Survey Schedule', 'Proposal', 'Net-Metering Progress'].map((item) => <div key={item} className="rounded-lg border bg-card p-4 text-center text-sm font-semibold">{item}</div>)}
          </div>
        </Panel>
        <NetMeteringWorkflowPanel view={netMeteringView} title="Net-metering progress" compact />
      </div>
    </div>
  );
}
