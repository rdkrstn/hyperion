import { useSolarOps } from '../../../shared/api/SolarOpsProvider';
import { PageHeader, Panel, StatCard } from '../../../shared/ui/primitives';
import { php } from '../../../shared/utils/format';

export function AnalyticsPage() {
  const { state } = useSolarOps();
  const won = state.deals.filter((deal) => deal.status === 'won');
  const open = state.deals.filter((deal) => deal.status === 'open');
  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Owner/manager review of lifecycle throughput. AI summaries can be added here later with Gemini." />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Leads" value={state.leads.length.toString()} note="Captured buyers" />
        <StatCard label="Deals" value={state.deals.length.toString()} note={`${open.length} open`} />
        <StatCard label="Won value" value={php.format(won.reduce((sum, deal) => sum + deal.value, 0))} />
        <StatCard label="Validated surveys" value={state.surveys.filter((survey) => survey.validationOutcome === 'validated').length.toString()} />
      </div>
      <Panel title="Lifecycle counts">
        <div className="grid gap-3 md:grid-cols-4">
          {['deal_created', 'solar_snapshot_reviewed', 'survey_scheduled', 'survey_validated', 'proposal_built', 'client_portal_shared', 'contract_accepted', 'won'].map((stage) => (
            <div key={stage} className="rounded-lg bg-base-200 p-3">
              <p className="text-xs uppercase text-base-content/50">{stage.replaceAll('_', ' ')}</p>
              <p className="text-xl font-semibold">{state.deals.filter((deal) => deal.stage === stage).length}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
