import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDealPrimaryAction, scheduleSurveyGate } from '../services/dealService';
import { useSolarOps } from '../../../shared/api/SolarOpsProvider';
import { Badge, EmptyState, Info, PageHeader, Panel } from '../../../shared/ui/primitives';
import { php, titleize } from '../../../shared/utils/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SolarWorkbench } from '../../solar-snapshot/components/SolarWorkbench';
import { buildNetMeteringWorkflowView } from '../../net-metering/services/netMeteringWorkflowService';
import { NetMeteringWorkflowPanel } from '../../net-metering/components/NetMeteringWorkflowPanel';
import { DocumentFileActions } from '../../documents/components/DocumentFileActions';

const tabs = ['Overview', 'Commercial', 'Solar Snapshot', 'Surveys', 'Proposal', 'Client Portal', 'Documents', 'Net-Metering', 'Timeline'];

export function DealDetailPage() {
  const { id = '' } = useParams();
  const { state, actions } = useSolarOps();
  const deal = state.deals.find((item) => item.id === id);
  const [tab, setTab] = useState(tabs[0]);
  const [installerId, setInstallerId] = useState('installer-1');
  const [scheduledAt, setScheduledAt] = useState('2026-05-25T09:00');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  if (!deal) return <EmptyState text="Deal not found." action={<Button asChild variant="outline"><Link to="/deals">Back to deals</Link></Button>} />;
  const currentDeal = deal;

  const lead = state.leads.find((item) => item.id === currentDeal.leadId);
  const solar = state.solarSnapshots.find((snapshot) => snapshot.dealId === currentDeal.id || snapshot.leadId === currentDeal.leadId);
  const surveys = state.surveys.filter((survey) => survey.dealId === currentDeal.id);
  const documents = state.documents.filter((document) => document.dealId === currentDeal.id || document.leadId === currentDeal.leadId);
  const proposals = state.proposals.filter((proposal) => proposal.dealId === currentDeal.id);
  const portal = state.clientPortals.find((item) => item.dealId === currentDeal.id);
  const netMeteringView = buildNetMeteringWorkflowView({
    deal: currentDeal,
    documents,
    surveys,
    utilityProvider: lead?.siteProfile.utilityProvider,
  });
  const timeline = state.timelineEvents.filter((event) => event.ownerId === currentDeal.id || surveys.some((survey) => survey.id === event.ownerId) || proposals.some((proposal) => proposal.id === event.ownerId));
  const action = getDealPrimaryAction(currentDeal);

  function runPrimaryAction() {
    setMessage('');
    if (action.id === 'run_solar_snapshot') {
      if (!lead?.siteProfile.latitude || !lead.siteProfile.longitude) {
        setMessage('Lead needs a confirmed Solar Snapshot pin before roof review.');
        return;
      }
      const result = actions.runSolarSnapshot(currentDeal.leadId, currentDeal.id, {
        latitude: lead.siteProfile.latitude,
        longitude: lead.siteProfile.longitude,
      });
      setMessage(result.message ?? result.error ?? '');
    }
    if (action.id === 'schedule_survey') {
      const result = actions.scheduleSurvey(currentDeal.id, { installerId, scheduledAt, location: currentDeal.leadSnapshot.location });
      setMessage(result.message ?? result.error ?? '');
      if (result.ok && result.data) navigate(`/surveys/${result.data.id}`);
    }
    if (action.id === 'build_proposal') navigate(`/proposals/${currentDeal.id}`);
    if (action.id === 'share_portal') {
      const result = actions.shareClientPortal(currentDeal.id);
      setMessage(result.message ?? result.error ?? '');
    }
    if (action.id === 'send_contract') navigate(`/proposals/${currentDeal.id}`);
    if (action.id === 'mark_won') actions.markDealWon(currentDeal.id, 'Contract accepted.');
  }

  return (
    <div className="space-y-6">
      <PageHeader title={deal.name} description={`${deal.leadSnapshot.businessName} / ${titleize(deal.stage)}`} action={<Button asChild size="sm" variant="outline"><Link to="/deals">Back to deals</Link></Button>} />
      {message ? <Alert><AlertDescription>{message}</AlertDescription></Alert> : null}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="max-w-full flex-wrap justify-start">
          {tabs.map((item) => <TabsTrigger key={item} value={item}>{item}</TabsTrigger>)}
        </TabsList>

      <TabsContent value="Overview" className="mt-4">
        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <Panel title="Primary stage action">
            <p className="text-sm text-muted-foreground">{action.reason}</p>
            {action.id === 'schedule_survey' && (
              <div className="mt-4 grid gap-3">
                <Input value={installerId} onChange={(event) => setInstallerId(event.target.value)} />
                <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
                {!scheduleSurveyGate(deal).allowed ? <Alert className="border-amber-200 bg-amber-50 text-amber-900"><AlertDescription>{scheduleSurveyGate(deal).reason}</AlertDescription></Alert> : null}
              </div>
            )}
            <Button className="mt-4 w-full" disabled={!action.enabled} onClick={runPrimaryAction}>{action.label}</Button>
          </Panel>
          <Panel title="Deal snapshot">
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Value" value={php.format(deal.value)} />
              <Info label="Status" value={<Badge>{titleize(deal.status)}</Badge>} />
              <Info label="Sales owner" value={deal.salesOwner} />
              <Info label="Source" value={titleize(deal.source)} />
              <Info label="Survey" value={titleize(deal.surveyStatus)} />
              <Info label="Proposal" value={titleize(deal.proposalStatus)} />
            </div>
          </Panel>
        </div>
      </TabsContent>

      <TabsContent value="Commercial" className="mt-4"><Panel title="Commercial packet"><div className="grid gap-3 md:grid-cols-4"><Info label="System size" value={`${deal.commercialPacket.proposedSystemSizeKwp} kWp`} /><Info label="Price" value={php.format(deal.commercialPacket.estimatedPrice)} /><Info label="Margin" value={`${deal.commercialPacket.grossMarginPercent}%`} /><Info label="Payment" value={deal.commercialPacket.paymentOption} /></div></Panel></TabsContent>
      <TabsContent value="Solar Snapshot" className="mt-4">
        <div className="space-y-4">
          <Panel title="Solar Snapshot">
            {solar ? (
              <div className="grid gap-3 md:grid-cols-4">
                <Info label="Status" value={solar.status} />
                <Info label="Capacity" value={`${solar.roofCapacityKwp} kWp`} />
                <Info label="Selected panels" value={`${solar.selectedPanelCount}/${solar.maxPanels}`} />
                <Info label="Production" value={`${solar.annualProductionKwh.toLocaleString()} kWh`} />
              </div>
            ) : <EmptyState text="Run Solar Snapshot before survey dispatch." />}
          </Panel>
          {solar ? (
            <Panel title="Solar Workbench">
              <SolarWorkbench snapshot={solar} onApply={(input) => actions.updateSolarPanelLayout(solar.id, input)} />
            </Panel>
          ) : null}
        </div>
      </TabsContent>
      <TabsContent value="Surveys" className="mt-4"><Panel title="Linked surveys">{surveys.length ? surveys.map((survey) => <Info key={survey.id} label={new Date(survey.scheduledAt).toLocaleString()} value={<Link to={`/surveys/${survey.id}`}>{titleize(survey.validationOutcome)}</Link>} />) : <EmptyState text="No surveys scheduled." />}</Panel></TabsContent>
      <TabsContent value="Proposal" className="mt-4"><Panel title="Proposals">{proposals.length ? proposals.map((proposal) => <Info key={proposal.id} label={`Revision ${proposal.revision}`} value={<Link to={`/proposals/${deal.id}`}>{titleize(proposal.status)} / {php.format(proposal.subtotal)}</Link>} />) : <EmptyState text="No proposal yet." action={<Button asChild><Link to={`/proposals/${deal.id}`}>Build proposal</Link></Button>} />}</Panel></TabsContent>
      <TabsContent value="Client Portal" className="mt-4"><Panel title="Client Portal">{portal ? <Info label="Public link" value={<Link to={`/portal/${portal.token}`}>{portal.publicUrl}</Link>} /> : <EmptyState text="No portal shared yet." />}</Panel></TabsContent>
      <TabsContent value="Documents" className="mt-4"><Panel title="Documents">{documents.length ? documents.map((document) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-2"><Info label={document.category} value={`${document.fileName} / ${document.validationStatus}`} /><DocumentFileActions document={document} actions={actions} compact /></div>) : <EmptyState text="No documents linked." />}</Panel></TabsContent>
      <TabsContent value="Net-Metering" className="mt-4"><NetMeteringWorkflowPanel view={netMeteringView} /></TabsContent>
      <TabsContent value="Timeline" className="mt-4"><Panel title="Timeline">{timeline.length ? timeline.map((event) => <div key={event.id} className="border-b py-2"><p className="font-medium">{event.title}</p><p className="text-sm text-muted-foreground">{event.description}</p></div>) : <EmptyState text="No deal timeline yet." />}</Panel></TabsContent>
      </Tabs>
      {!lead ? null : <p className="text-xs text-muted-foreground">Lead source remains <Link to={`/leads/${lead.id}`} className="underline underline-offset-4">the lead record</Link>, not duplicate editable deal fields.</p>}
    </div>
  );
}
