import { Link } from 'react-router-dom';
import { useSolarOps } from '../../shared/api/SolarOpsProvider';
import { Badge, EmptyState, PageHeader, Panel, StatCard } from '../../shared/ui/primitives';
import { php } from '../../shared/utils/format';
import { Button } from '@/components/ui/button';
import { buildGoldenDemoModel } from '../../shared/demo/goldenDemo';
import { GoldenDemoProgress } from '../../shared/demo/GoldenDemoProgress';
import { buildDemoAutomationEvents } from '../../domains/automations/services/automationService';

export function DashboardPage() {
  const { state, actions } = useSolarOps();
  const demo = buildGoldenDemoModel(state);
  const openDeals = state.deals.filter((deal) => deal.status === 'open');
  const activeLeads = state.leads.filter((lead) => lead.status !== 'archived');
  const qualifiedDeals = state.deals.filter((deal) => deal.stage !== 'deal_created');
  const automationEvents = buildDemoAutomationEvents(demo.accountName);
  const blockers = demo.blockers.length ? demo.blockers : ['No active blockers in the golden demo.'];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Hyperion turns solar lead intake, site readiness, documents, surveys, proposals, and net-metering blockers into one local demo workflow."
        action={(
          <>
            <Button size="sm" variant="outline" onClick={() => actions.loadGoldenDemo()}>Load golden demo</Button>
            <Button asChild size="sm"><Link to="/workbench">Continue in Workbench</Link></Button>
          </>
        )}
      />
      <GoldenDemoProgress model={demo} onLoad={actions.loadGoldenDemo} onRunNext={actions.runGoldenDemoNextStep} />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Active leads" value={activeLeads.length.toString()} note="Local demo records" />
        <StatCard label="Qualified deals" value={qualifiedDeals.length.toString()} note={`${openDeals.length} open`} />
        <StatCard label="Proposal value" value={php.format(state.deals.reduce((sum, deal) => sum + deal.value, 0))} note="Demo pipeline" />
        <StatCard label="Automation events" value={automationEvents.length.toString()} note="Simulated locally" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Golden demo account">
          {demo.loaded && demo.deal ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="text-lg font-semibold">{demo.accountName}</p>
                  <p className="text-sm text-muted-foreground">{demo.deal.name}</p>
                </div>
                <Badge tone={demo.blockers.length ? 'warning' : 'success'}>{demo.currentStepId.replaceAll('_', ' ')}</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Score</p><p className="text-2xl font-semibold">{demo.metrics.readinessScore}/100</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">System</p><p className="text-2xl font-semibold">{demo.metrics.selectedSystemSizeKwp} kWp</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Production</p><p className="text-2xl font-semibold">{demo.metrics.annualProductionKwh.toLocaleString()} kWh</p></div>
              </div>
            </div>
          ) : <EmptyState text="Load the golden demo to see Iloilo Mini Mart progress through the release workflow." action={<Button onClick={() => actions.loadGoldenDemo()}>Load golden demo</Button>} />}
        </Panel>
        <Panel title="Blockers">
          <div className="space-y-2">
            {blockers.map((blocker) => (
              <div key={blocker} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="text-sm">{blocker}</span>
                <Badge tone={demo.blockers.length ? 'warning' : 'success'}>{demo.blockers.length ? 'Open' : 'Clear'}</Badge>
              </div>
            ))}
          </div>
          <Button className="mt-4 w-full" onClick={() => actions.runGoldenDemoNextStep()}>{demo.nextAction}</Button>
        </Panel>
      </div>
      <Panel title="Workflow timeline">
        {state.timelineEvents.length ? (
          <div className="divide-y rounded-lg border">
            {state.timelineEvents.slice(0, 7).map((event) => (
              <div key={event.id} className="grid gap-2 p-3 md:grid-cols-[180px_1fr]">
                <span className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span>
                <div>
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState text="Timeline is empty. Load the golden demo to see lifecycle events." />}
      </Panel>
    </div>
  );
}
