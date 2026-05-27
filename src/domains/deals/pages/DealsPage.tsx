import { Link } from 'react-router-dom';
import { useSolarOps } from '../../../shared/api/SolarOpsProvider';
import { Badge, EmptyState, PageHeader, Panel, StatCard, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '../../../shared/ui/primitives';
import { php, titleize } from '../../../shared/utils/format';
import { Button } from '@/components/ui/button';

export function DealsPage() {
  const { state } = useSolarOps();
  const activeDeals = state.deals.filter((deal) => deal.status !== 'archived');
  const openValue = activeDeals.filter((deal) => deal.status === 'open').reduce((sum, deal) => sum + deal.value, 0);
  const wonValue = activeDeals.filter((deal) => deal.status === 'won').reduce((sum, deal) => sum + deal.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Deals" description="Deals commercialize qualified leads into solar projects." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Open value" value={php.format(openValue)} note={`${activeDeals.filter((deal) => deal.status === 'open').length} open`} />
        <StatCard label="Won value" value={php.format(wonValue)} note="Accepted contracts" />
        <StatCard label="Deals" value={activeDeals.length.toString()} note="Commercial projects" />
      </div>
      <Panel>
        {activeDeals.length ? (
          <TableWrap>
            <Table>
              <TableHeader><TableRow><TableHead>Deal</TableHead><TableHead>Linked lead</TableHead><TableHead>Value</TableHead><TableHead>Stage</TableHead><TableHead>Status</TableHead><TableHead>Owner</TableHead><TableHead>Survey</TableHead><TableHead>Proposal</TableHead><TableHead>Portal</TableHead><TableHead>Expected close</TableHead></TableRow></TableHeader>
              <TableBody>
                {activeDeals.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell><Link className="font-semibold text-primary" to={`/deals/${deal.id}`}>{deal.name}</Link></TableCell>
                    <TableCell><Link to={`/leads/${deal.leadId}`}>{deal.leadSnapshot.businessName}</Link></TableCell>
                    <TableCell>{php.format(deal.value)}</TableCell>
                    <TableCell><Badge tone="info">{titleize(deal.stage)}</Badge></TableCell>
                    <TableCell><Badge tone={deal.status === 'won' ? 'success' : deal.status === 'lost' ? 'error' : 'neutral'}>{titleize(deal.status)}</Badge></TableCell>
                    <TableCell>{deal.salesOwner}</TableCell>
                    <TableCell>{titleize(deal.surveyStatus)}</TableCell>
                    <TableCell>{titleize(deal.proposalStatus)}</TableCell>
                    <TableCell>{titleize(deal.portalStatus)}</TableCell>
                    <TableCell>{deal.expectedCloseDate || 'Not set'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        ) : <EmptyState text="No deals yet. Open a qualified lead and create a deal." action={<Button asChild><Link to="/leads">Go to leads</Link></Button>} />}
      </Panel>
    </div>
  );
}
