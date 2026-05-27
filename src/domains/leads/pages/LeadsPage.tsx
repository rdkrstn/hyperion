import { Link } from 'react-router-dom';
import { useSolarOps } from '../../../shared/api/SolarOpsProvider';
import { Badge, EmptyState, PageHeader, Panel, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '../../../shared/ui/primitives';
import { php, titleize } from '../../../shared/utils/format';
import { Button } from '@/components/ui/button';

export function LeadsPage() {
  const { state, actions } = useSolarOps();
  const leads = state.leads.filter((lead) => !lead.archivedAt);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Leads qualify the buyer before a commercial deal is created."
        action={(
          <>
            <Button size="sm" variant="outline" onClick={() => actions.loadDemoData()}>Load demo data</Button>
            <Button asChild size="sm"><Link to="/leads/new">New lead</Link></Button>
          </>
        )}
      />
      <Panel>
        {leads.length ? (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Monthly bill</TableHead>
                  <TableHead>Goal</TableHead>
                  <TableHead>Readiness</TableHead>
                  <TableHead>Qualification</TableHead>
                  <TableHead>Missing blocker</TableHead>
                  <TableHead>Next action</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell><Link className="font-semibold text-primary" to={`/leads/${lead.id}`}>{lead.businessName}</Link><p className="text-xs text-muted-foreground">{lead.contactName}</p></TableCell>
                    <TableCell>{titleize(lead.source)}</TableCell>
                    <TableCell>{php.format(lead.energyProfile.monthlyBill)}</TableCell>
                    <TableCell>{titleize(lead.goal)}</TableCell>
                    <TableCell><Badge tone={lead.readinessScore >= 75 ? 'success' : lead.readinessScore >= 55 ? 'warning' : 'error'}>{lead.readinessScore}/100</Badge></TableCell>
                    <TableCell>{titleize(lead.status)}</TableCell>
                    <TableCell>{lead.missingBlockers[0] ?? 'None'}</TableCell>
                    <TableCell>{lead.nextAction}</TableCell>
                    <TableCell>{lead.assignedSales || 'Unassigned'}</TableCell>
                    <TableCell>{new Date(lead.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState
            text="No leads yet. Start with a Solar Readiness Intake or load the curated recording dataset."
            action={(
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => actions.loadDemoData()}>Load demo data</Button>
                <Button asChild><Link to="/leads/new">Create first lead</Link></Button>
              </div>
            )}
          />
        )}
      </Panel>
    </div>
  );
}
