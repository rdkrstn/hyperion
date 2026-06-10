import { Cable, RadioTower } from 'lucide-react';
import { useSolarOps } from '../../../shared/api/SolarOpsProvider';
import { Badge, PageHeader, Panel, StatCard } from '../../../shared/ui/primitives';
import { Button } from '@/components/ui/button';
import { automationRecipes, buildDemoAutomationEvents } from '../services/automationService';
import { buildGoldenDemoModel } from '../../../shared/demo/goldenDemo';

export function AutomationsPage() {
  const { state, actions } = useSolarOps();
  const demo = buildGoldenDemoModel(state);
  const events = buildDemoAutomationEvents(demo.accountName);
  const mode = import.meta.env.VITE_AUTOMATION_MODE || 'local';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automations"
        description="Hyperion exposes n8n-ready workflow handoffs. The public demo simulates events locally and never calls external webhooks by default."
        action={<Button onClick={() => actions.runGoldenDemoNextStep()}>{demo.nextAction}</Button>}
      />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Recipes" value={automationRecipes.length.toString()} note="Webhook-ready patterns" />
        <StatCard label="Mode" value={mode} note="Default is local" />
        <StatCard label="Demo events" value={events.length.toString()} note="Generated from recipes" />
        <StatCard label="External calls" value={mode === 'webhook' ? 'Opt-in' : 'Off'} note="No side effects in demo" />
      </div>
      <Panel title="n8n handoff recipes">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {automationRecipes.map((recipe) => (
            <div key={recipe.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-amber-50 text-amber-700"><Cable className="size-4" /></span>
                  <div>
                    <p className="font-semibold">{recipe.title}</p>
                    <p className="text-xs text-muted-foreground">{recipe.sourceModule}</p>
                  </div>
                </div>
                <Badge tone="info">Simulated/local</Badge>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div><p className="text-xs font-semibold uppercase text-muted-foreground">Trigger</p><p>{recipe.trigger}</p></div>
                <div><p className="text-xs font-semibold uppercase text-muted-foreground">Action</p><p>{recipe.action}</p></div>
                <div><p className="text-xs font-semibold uppercase text-muted-foreground">Webhook env</p><code className="text-xs">{recipe.envVar}</code></div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Simulated event log">
        <div className="divide-y rounded-lg border">
          {events.map((event) => (
            <div key={event.id} className="grid gap-3 p-3 md:grid-cols-[180px_1fr_140px]">
              <span className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span>
              <div className="flex items-start gap-3">
                <RadioTower className="mt-0.5 size-4 text-amber-600" />
                <div>
                  <p className="text-sm font-medium">{event.eventName}</p>
                  <p className="text-xs text-muted-foreground">{event.accountName} / {event.sourceModule} / {event.target}</p>
                </div>
              </div>
              <Badge tone="success">{event.status}</Badge>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
