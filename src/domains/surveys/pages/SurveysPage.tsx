import { Link } from 'react-router-dom';
import { useSolarOps } from '../../../shared/api/SolarOpsProvider';
import { Badge, EmptyState, PageHeader, Panel, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '../../../shared/ui/primitives';
import { titleize } from '../../../shared/utils/format';

export function SurveysPage() {
  const { state } = useSolarOps();

  return (
    <div className="space-y-6">
      <PageHeader title="Surveys" description="Installer/auditor work queue for scheduled technical validation." />
      <Panel>
        {state.surveys.length ? (
          <TableWrap>
            <Table>
              <TableHeader><TableRow><TableHead>Survey job</TableHead><TableHead>Deal / Lead</TableHead><TableHead>Installer</TableHead><TableHead>Schedule</TableHead><TableHead>Location</TableHead><TableHead>Solar Snapshot</TableHead><TableHead>Evidence</TableHead><TableHead>Validation</TableHead><TableHead>Blockers</TableHead></TableRow></TableHeader>
              <TableBody>
                {state.surveys.map((survey) => {
                  const deal = state.deals.find((item) => item.id === survey.dealId);
                  const solar = state.solarSnapshots.find((snapshot) => snapshot.dealId === survey.dealId || snapshot.leadId === survey.leadId);
                  return (
                    <TableRow key={survey.id}>
                      <TableCell><Link className="font-semibold text-primary" to={`/surveys/${survey.id}`}>Open survey</Link></TableCell>
                      <TableCell>{deal ? <Link to={`/deals/${deal.id}`}>{deal.name}</Link> : survey.dealId}</TableCell>
                      <TableCell>{survey.installerId}</TableCell>
                      <TableCell>{new Date(survey.scheduledAt).toLocaleString()}</TableCell>
                      <TableCell>{survey.location}</TableCell>
                      <TableCell>{solar?.status ?? 'pending'}</TableCell>
                      <TableCell>{survey.evidenceUploads.length}/4</TableCell>
                      <TableCell><Badge tone={survey.validationOutcome === 'validated' ? 'success' : survey.validationOutcome === 'blocked' ? 'error' : 'warning'}>{titleize(survey.validationOutcome)}</Badge></TableCell>
                      <TableCell>{survey.blockers[0] ?? 'None'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrap>
        ) : <EmptyState text="No surveys scheduled. Create a deal, run Solar Snapshot, then schedule the installer survey." />}
      </Panel>
    </div>
  );
}
