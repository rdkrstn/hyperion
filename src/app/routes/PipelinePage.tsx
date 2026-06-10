import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useSolarOps } from '../../shared/api/SolarOpsProvider';
import { Badge, EmptyState, PageHeader, Panel, StatCard } from '../../shared/ui/primitives';
import { php, titleize } from '../../shared/utils/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildGoldenDemoModel } from '../../shared/demo/goldenDemo';

export function PipelinePage() {
  const { state, actions } = useSolarOps();
  const demo = buildGoldenDemoModel(state);
  const activeLeads = state.leads.filter((lead) => lead.status !== 'archived');
  const openDeals = state.deals.filter((deal) => deal.status === 'open');
  const blockedDeals = openDeals.filter((deal) => deal.blocker || deal.documentStatus !== 'validated' || deal.surveyStatus !== 'validated');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="A sales and operations command view for leads, deals, readiness scores, and next actions."
        action={<Button onClick={() => actions.loadGoldenDemo()}>Load golden demo</Button>}
      />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Captured leads" value={activeLeads.length.toString()} />
        <StatCard label="Open deals" value={openDeals.length.toString()} />
        <StatCard label="Blocked records" value={blockedDeals.length.toString()} />
        <StatCard label="Open value" value={php.format(openDeals.reduce((sum, deal) => sum + deal.value, 0))} />
      </div>
      <Panel title="Command filter">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative max-w-lg flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search demo accounts, stages, or blockers" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">Golden: {demo.currentStepId.replaceAll('_', ' ')}</Badge>
            <Badge tone={demo.blockers.length ? 'warning' : 'success'}>{demo.blockers.length} blockers</Badge>
          </div>
        </div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Lead accounts">
          {activeLeads.length ? (
            <div className="grid gap-3">
              {activeLeads.map((lead) => (
                <Link key={lead.id} to={`/leads/${lead.id}`} className="rounded-lg border bg-card p-4 transition hover:border-amber-300 hover:bg-amber-50/30">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{lead.businessName}</p>
                      <p className="text-sm text-muted-foreground">{lead.contactName} / {lead.siteProfile.location}</p>
                    </div>
                    <Badge tone={lead.readinessScore >= 75 ? 'success' : lead.readinessScore >= 55 ? 'warning' : 'error'}>{lead.readinessScore}/100</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{titleize(lead.source)}</span>
                    <span>{titleize(lead.customerType)}</span>
                    <span>{lead.recommendedSystemRange}</span>
                  </div>
                  <p className="mt-3 text-sm">{lead.nextAction}</p>
                </Link>
              ))}
            </div>
          ) : <EmptyState text="No leads yet. Load the golden demo to populate the public release workflow." action={<Button onClick={() => actions.loadGoldenDemo()}>Load golden demo</Button>} />}
        </Panel>
        <Panel title="Deal operations">
          {openDeals.length ? (
            <div className="grid gap-3">
              {openDeals.map((deal) => (
                <Link key={deal.id} to={`/deals/${deal.id}`} className="rounded-lg border bg-card p-4 transition hover:border-amber-300 hover:bg-amber-50/30">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{deal.name}</p>
                      <p className="text-sm text-muted-foreground">{deal.leadSnapshot.businessName} / {php.format(deal.value)}</p>
                    </div>
                    <Badge tone={deal.blocker ? 'warning' : 'success'}>{titleize(deal.stage)}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <div className="rounded-lg bg-muted/40 p-2 text-xs">Docs: {titleize(deal.documentStatus)}</div>
                    <div className="rounded-lg bg-muted/40 p-2 text-xs">Survey: {titleize(deal.surveyStatus)}</div>
                    <div className="rounded-lg bg-muted/40 p-2 text-xs">Proposal: {titleize(deal.proposalStatus)}</div>
                  </div>
                  <p className="mt-3 text-sm">{deal.nextAction}</p>
                </Link>
              ))}
            </div>
          ) : <EmptyState text="No active deals. The golden demo creates a clear deal record for Iloilo Mini Mart." />}
        </Panel>
      </div>
    </div>
  );
}
