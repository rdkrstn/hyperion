import { Link } from 'react-router-dom';
import { useSolarOps } from '../../shared/api/SolarOpsProvider';
import { EmptyState, PageHeader, Panel, StatCard } from '../../shared/ui/primitives';
import { php } from '../../shared/utils/format';
import { Button } from '@/components/ui/button';

export function DashboardPage() {
  const { state, actions } = useSolarOps();
  const openDeals = state.deals.filter((deal) => deal.status === 'open');
  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations dashboard"
        description="Clean lifecycle snapshot across Leads, Deals, Solar Snapshots, Surveys, Documents, Proposals, and Client Portal."
        action={(
          <>
            <Button size="sm" variant="outline" onClick={() => actions.loadDemoData()}>Load demo data</Button>
            <Button asChild size="sm"><Link to="/leads/new">Create lead</Link></Button>
          </>
        )}
      />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Leads" value={state.leads.length.toString()} />
        <StatCard label="Open deals" value={openDeals.length.toString()} />
        <StatCard label="Open value" value={php.format(openDeals.reduce((sum, deal) => sum + deal.value, 0))} />
        <StatCard label="Surveys" value={state.surveys.length.toString()} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Next deals">
          {openDeals.length ? openDeals.slice(0, 5).map((deal) => <Link key={deal.id} className="block border-b py-2 text-primary" to={`/deals/${deal.id}`}>{deal.name} / {deal.nextAction}</Link>) : <EmptyState text="No open deals yet. Qualify a lead and create a deal." />}
        </Panel>
        <Panel title="Document blockers">
          {state.deals.filter((deal) => deal.documentStatus !== 'validated').length ? state.deals.filter((deal) => deal.documentStatus !== 'validated').slice(0, 5).map((deal) => <Link key={deal.id} className="block border-b py-2 text-primary" to={`/documents`}>{deal.name} / {deal.documentStatus}</Link>) : <EmptyState text="No document blockers." />}
        </Panel>
      </div>
    </div>
  );
}
