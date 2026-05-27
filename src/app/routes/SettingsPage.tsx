import { resetSolarOpsLocalState } from '../../shared/api/SolarOpsProvider';
import { useSolarOps } from '../../shared/api/SolarOpsProvider';
import { PageHeader, Panel } from '../../shared/ui/primitives';
import { Button } from '@/components/ui/button';

export function SettingsPage() {
  const { actions } = useSolarOps();
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Environment status and local workspace controls." />
      <Panel title="Environment">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-muted/60 p-3"><p className="font-semibold">Supabase</p><p className="text-sm text-muted-foreground">{import.meta.env.VITE_SUPABASE_URL ? 'Configured' : 'Local workspace mode'}</p></div>
          <div className="rounded-lg bg-muted/60 p-3"><p className="font-semibold">Google Maps / Solar</p><p className="text-sm text-muted-foreground">{import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ? 'Browser key configured' : 'Manual/local snapshot fallback'}</p></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => actions.loadDemoData()}>Load demo data</Button>
          <Button variant="destructive" onClick={resetSolarOpsLocalState}>Reset local workspace</Button>
        </div>
      </Panel>
    </div>
  );
}
