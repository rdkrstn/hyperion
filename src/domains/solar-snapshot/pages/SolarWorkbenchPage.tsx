import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '../../../shared/ui/primitives';
import { useSolarOps } from '../../../shared/api/SolarOpsProvider';
import { SolarWorkbench } from '../components/SolarWorkbench';

export function SolarWorkbenchPage() {
  const { id = '' } = useParams();
  const { state, actions } = useSolarOps();
  const snapshot = state.solarSnapshots.find((item) => item.id === id);

  if (!snapshot) {
    return <EmptyState text="Solar Snapshot not found." action={<Button asChild variant="outline"><Link to="/leads">Back to leads</Link></Button>} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solar Workbench"
        description="Operator-facing roof layout review for capacity, panel placement, and proposal-ready Solar Snapshot sizing."
        action={<Button asChild size="sm" variant="outline"><Link to={snapshot.dealId ? `/deals/${snapshot.dealId}` : `/leads/${snapshot.leadId}`}>Back to record</Link></Button>}
      />
      <SolarWorkbench snapshot={snapshot} mode="full" onApply={(input) => actions.updateSolarPanelLayout(snapshot.id, input)} />
    </div>
  );
}
