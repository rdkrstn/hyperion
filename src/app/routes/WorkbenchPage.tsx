import { Link } from 'react-router-dom';
import { CheckCircle2, FileCheck2, Hammer, ShieldCheck } from 'lucide-react';
import { useSolarOps } from '../../shared/api/SolarOpsProvider';
import { Badge, EmptyState, Info, PageHeader, Panel } from '../../shared/ui/primitives';
import { php, titleize } from '../../shared/utils/format';
import { Button } from '@/components/ui/button';
import { buildGoldenDemoModel } from '../../shared/demo/goldenDemo';
import { GoldenDemoProgress } from '../../shared/demo/GoldenDemoProgress';
import { SolarWorkbench } from '../../domains/solar-snapshot/components/SolarWorkbench';
import { documentCategoryLabel } from '../../domains/documents/services/documentService';
import { buildNetMeteringWorkflowView } from '../../domains/net-metering/services/netMeteringWorkflowService';
import { NetMeteringWorkflowPanel } from '../../domains/net-metering/components/NetMeteringWorkflowPanel';

export function WorkbenchPage() {
  const { state, actions } = useSolarOps();
  const demo = buildGoldenDemoModel(state);
  const netMeteringView = demo.deal ? buildNetMeteringWorkflowView({
    deal: demo.deal,
    documents: demo.documents,
    surveys: demo.surveys,
    utilityProvider: demo.lead?.siteProfile.utilityProvider,
  }) : undefined;
  const contract = demo.activeProposal ? state.proposalContracts.find((item) => item.proposalId === demo.activeProposal?.id) : undefined;
  const survey = demo.surveys[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workbench"
        description="The golden demo cockpit for moving one solar account through readiness, documents, survey validation, proposal, and contract-ready handoff."
        action={<Button onClick={() => actions.runGoldenDemoNextStep()}>{demo.nextAction}</Button>}
      />
      <GoldenDemoProgress model={demo} onLoad={actions.loadGoldenDemo} onRunNext={actions.runGoldenDemoNextStep} compact />
      {!demo.loaded ? (
        <EmptyState text="Load the golden demo to open the Iloilo Mini Mart workbench." action={<Button onClick={() => actions.loadGoldenDemo()}>Load golden demo</Button>} />
      ) : (
        <>
          <Panel title="Account header">
            <div className="grid gap-3 md:grid-cols-5">
              <Info label="Account" value={demo.accountName} />
              <Info label="Score" value={`${demo.metrics.readinessScore}/100`} />
              <Info label="Monthly bill" value={php.format(demo.metrics.monthlyBill)} />
              <Info label="System size" value={`${demo.metrics.selectedSystemSizeKwp} kWp`} />
              <Info label="Deal stage" value={demo.deal ? titleize(demo.deal.stage) : 'Not loaded'} />
            </div>
          </Panel>

          <Panel title="Solar Snapshot" action={<Badge tone={demo.solarSnapshot?.status === 'ready' ? 'success' : 'warning'}>{demo.solarSnapshot?.imageryQuality ?? 'Pending'}</Badge>}>
            {demo.solarSnapshot ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <Info label="Roof capacity" value={`${demo.solarSnapshot.roofCapacityKwp} kWp`} />
                  <Info label="Panels" value={`${demo.solarSnapshot.selectedPanelCount}/${demo.solarSnapshot.maxPanels}`} />
                  <Info label="Selected size" value={`${demo.solarSnapshot.selectedSystemSizeKwp} kWp`} />
                  <Info label="Production" value={`${demo.solarSnapshot.annualProductionKwh.toLocaleString()} kWh/year`} />
                </div>
                <SolarWorkbench snapshot={demo.solarSnapshot} onApply={(input) => actions.updateSolarPanelLayout(demo.solarSnapshot!.id, input)} />
              </div>
            ) : <EmptyState text="Solar Snapshot is not loaded. Run the golden demo to create the local roof review." />}
          </Panel>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Document readiness" action={<Button size="sm" variant="outline" onClick={() => actions.runGoldenDemoNextStep()}>Validate demo docs</Button>}>
              <div className="space-y-3">
                {demo.documents.filter((document) => ['customer_bill', 'valid_id', 'site_control_document'].includes(document.category)).map((document) => (
                  <div key={document.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <FileCheck2 className="size-4 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium">{documentCategoryLabel(document.category)}</p>
                        <p className="text-xs text-muted-foreground">{document.fileName}</p>
                      </div>
                    </div>
                    <Badge tone={document.validationStatus === 'validated' ? 'success' : 'warning'}>{titleize(document.validationStatus)}</Badge>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Installer survey" action={<Button size="sm" variant="outline" onClick={() => actions.runGoldenDemoNextStep()}>Validate survey</Button>}>
              {survey ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <Hammer className="size-4 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium">{survey.location}</p>
                        <p className="text-xs text-muted-foreground">{survey.evidenceUploads.length} evidence uploads</p>
                      </div>
                    </div>
                    <Badge tone={survey.validationOutcome === 'validated' ? 'success' : 'warning'}>{titleize(survey.validationOutcome)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Installer completion requires Main Breaker Panel, Roof Surface, Inverter Location, Wire Run Path, and roof structural soundness.</p>
                </div>
              ) : <EmptyState text="Survey is not validated yet. Run the next golden demo step to simulate installer evidence." />}
            </Panel>
          </div>

          <NetMeteringWorkflowPanel view={netMeteringView} title="Net-metering readiness" compact />

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Panel title="Proposal" action={<Button size="sm" variant="outline" onClick={() => actions.runGoldenDemoNextStep()}>Generate proposal</Button>}>
              {demo.activeProposal ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <Info label="Revision" value={demo.activeProposal.revision} />
                    <Info label="Status" value={titleize(demo.activeProposal.status)} />
                    <Info label="Subtotal" value={php.format(demo.activeProposal.subtotal)} />
                    <Info label="Margin" value={`${demo.activeProposal.grossMarginPercent}%`} />
                  </div>
                  <div className="divide-y rounded-lg border">
                    {demo.activeProposal.scopeLines.map((line) => (
                      <div key={line.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                        <div>
                          <p className="text-sm font-medium">{line.name}</p>
                          <p className="text-xs text-muted-foreground">{line.sourceReason}</p>
                        </div>
                        <span className="text-sm font-semibold">{php.format(line.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <EmptyState text="Proposal is pending. Clear documents and survey validation first, then generate a frozen demo proposal." />}
            </Panel>
            <Panel title="Contract-ready handoff">
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="flex items-center gap-2 text-sm"><ShieldCheck className="size-4 text-amber-600" /> Frozen proposal</span>
                  <Badge tone={demo.activeProposal?.frozenAt ? 'success' : 'warning'}>{demo.activeProposal?.frozenAt ? 'Ready' : 'Pending'}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 text-amber-600" /> Contract link</span>
                  <Badge tone={contract ? 'success' : 'warning'}>{contract ? titleize(contract.status) : 'Not generated'}</Badge>
                </div>
                {contract ? <Button asChild variant="outline" className="w-full"><Link to={`/contracts/${contract.token}`}>Open public contract</Link></Button> : null}
                <Button className="w-full" onClick={() => actions.runGoldenDemoNextStep()}>{demo.nextAction}</Button>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
