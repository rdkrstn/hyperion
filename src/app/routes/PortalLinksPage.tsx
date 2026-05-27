import { Link } from 'react-router-dom';
import { useSolarOps } from '../../shared/api/SolarOpsProvider';
import { EmptyState, PageHeader, Panel, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '../../shared/ui/primitives';

export function PortalLinksPage() {
  const { state } = useSolarOps();
  return (
    <div className="space-y-6">
      <PageHeader title="Client Portal Links" description="Public customer portal links generated from deals." />
      <Panel>
        {state.clientPortals.length ? (
          <TableWrap>
            <Table>
              <TableHeader><TableRow><TableHead>Deal</TableHead><TableHead>Status</TableHead><TableHead>URL</TableHead></TableRow></TableHeader>
              <TableBody>{state.clientPortals.map((portal) => {
                const deal = state.deals.find((item) => item.id === portal.dealId);
                return <TableRow key={portal.id}><TableCell>{deal?.name ?? portal.dealId}</TableCell><TableCell>{portal.status}</TableCell><TableCell><Link className="underline underline-offset-4" to={`/portal/${portal.token}`}>{portal.publicUrl}</Link></TableCell></TableRow>;
              })}</TableBody>
            </Table>
          </TableWrap>
        ) : <EmptyState text="No Client Portal links yet. Freeze a proposal and share the portal from a deal." />}
      </Panel>
    </div>
  );
}
