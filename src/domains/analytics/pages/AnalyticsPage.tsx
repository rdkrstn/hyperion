import { useSolarOps } from '../../../shared/api/SolarOpsProvider';
import { Badge, PageHeader, Panel, StatCard } from '../../../shared/ui/primitives';
import { php, titleize } from '../../../shared/utils/format';
import { buildGoldenDemoModel } from '../../../shared/demo/goldenDemo';
import { buildDemoAutomationEvents } from '../../automations/services/automationService';

export function AnalyticsPage() {
  const { state } = useSolarOps();
  const demo = buildGoldenDemoModel(state);
  const won = state.deals.filter((deal) => deal.status === 'won');
  const open = state.deals.filter((deal) => deal.status === 'open');
  const blockers = state.deals.filter((deal) => deal.blocker || deal.documentStatus !== 'validated');
  const events = buildDemoAutomationEvents(demo.accountName);
  const stages = ['deal_created', 'solar_snapshot_reviewed', 'survey_scheduled', 'survey_validated', 'proposal_built', 'client_portal_shared', 'contract_accepted', 'won'];

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Demo-labeled owner/manager metrics for the Hyperion local workflow. Production report RAG remains scaffolded behind Edge Functions." />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Leads" value={state.leads.length.toString()} note="Captured demo buyers" />
        <StatCard label="Deals" value={state.deals.length.toString()} note={`${open.length} open`} />
        <StatCard label="Won value" value={php.format(won.reduce((sum, deal) => sum + deal.value, 0))} />
        <StatCard label="Automation activity" value={events.length.toString()} note="Local simulation" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Qualification funnel">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Captured</p><p className="text-2xl font-semibold">{state.leads.length}</p></div>
            <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Qualified</p><p className="text-2xl font-semibold">{state.leads.filter((lead) => lead.status !== 'captured').length}</p></div>
            <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Proposal-ready</p><p className="text-2xl font-semibold">{state.proposals.filter((proposal) => proposal.frozenAt).length}</p></div>
          </div>
          <div className="mt-4 space-y-2">
            {state.leads.slice(0, 6).map((lead) => (
              <div key={lead.id} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">{lead.businessName}</span>
                <Badge tone={lead.readinessScore >= 75 ? 'success' : lead.readinessScore >= 55 ? 'warning' : 'error'}>{lead.readinessScore}/100</Badge>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Blockers by type">
          <div className="space-y-3">
            {[
              ['Document blockers', blockers.length],
              ['Survey not validated', state.deals.filter((deal) => deal.surveyStatus !== 'validated').length],
              ['Proposal pending', state.deals.filter((deal) => deal.proposalStatus === 'draft').length],
              ['Net-metering blocked', demo.blockers.length],
            ].map(([label, count]) => (
              <div key={label} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">{label}</span>
                <Badge tone={Number(count) ? 'warning' : 'success'}>{count}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Lifecycle counts">
        <div className="grid gap-3 md:grid-cols-4">
          {stages.map((stage) => (
            <div key={stage} className="rounded-lg border bg-muted/35 p-3">
              <p className="text-xs uppercase text-muted-foreground">{titleize(stage)}</p>
              <p className="text-xl font-semibold">{state.deals.filter((deal) => deal.stage === stage).length}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
