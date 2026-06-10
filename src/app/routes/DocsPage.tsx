import { Link } from 'react-router-dom';
import { Badge, PageHeader, Panel } from '../../shared/ui/primitives';
import { Button } from '@/components/ui/button';

const statusRows = [
  ['Public UI shell', 'v1 demo-ready'],
  ['Golden demo loop', 'v1 demo-ready'],
  ['Domain-driven modules', 'Built'],
  ['Local demo workflow', 'Built'],
  ['Supabase schema/RLS/buckets', 'Scaffolded'],
  ['Supabase Edge Functions', 'Scaffolded'],
  ['Production mutation wiring', 'Partial'],
  ['n8n automation handoffs', 'Local simulation / webhook-ready'],
  ['Vitest coverage', 'Broad'],
  ['Legacy cleanup', 'Pending'],
];

export function DocsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Docs"
        description="Project status, architecture boundaries, local demo mode, and public-release context for Hyperion."
        action={<Button asChild variant="outline"><Link to="/workbench">Open Workbench</Link></Button>}
      />
      <Panel title="What Hyperion is">
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Hyperion is an open-source workflow platform for solar PV installers: leads, surveys, proposals, documents, net-metering, automation handoffs, and project operations.
          </p>
          <p>
            This public release is a demo/reference implementation. The active UI workflow is powered by a local demo store, while Supabase tables, RLS policies, Storage buckets, and Edge Function boundaries are scaffolded for production integration.
          </p>
        </div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Current release status">
          <div className="divide-y rounded-lg border">
            {statusRows.map(([area, status]) => (
              <div key={area} className="flex items-center justify-between gap-3 p-3">
                <span className="text-sm">{area}</span>
                <Badge tone={status.includes('Partial') || status.includes('Pending') ? 'warning' : 'success'}>{status}</Badge>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Architecture">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ['App shell', 'React Router, role-aware layout, public token routes, simplified demo navigation.'],
              ['Domain modules', 'Leads, deals, snapshots, surveys, documents, proposals, portal, tickets, analytics, qualification.'],
              ['Local demo store', 'Local persistence and golden demo actions for no-credential startup.'],
              ['Business mutations', 'Supabase Edge Function client boundary for production workflow actions.'],
              ['Supabase backend', 'Canonical migration, RLS, private buckets, and server-side integrations.'],
              ['Automation handoffs', 'Optional n8n webhook recipes, simulated locally by default.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border p-4">
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Contributor pointers">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-4"><p className="font-semibold">Run locally</p><p className="mt-1 text-sm text-muted-foreground">Install dependencies, run Vite, load the golden demo, and follow the Workbench.</p></div>
          <div className="rounded-lg border p-4"><p className="font-semibold">Backend status</p><p className="mt-1 text-sm text-muted-foreground">Supabase scaffolding is present, but the active UI is not fully production-wired.</p></div>
          <div className="rounded-lg border p-4"><p className="font-semibold">Security</p><p className="mt-1 text-sm text-muted-foreground">Never commit API keys, Supabase service role keys, webhook secrets, signing secrets, or real customer data.</p></div>
        </div>
      </Panel>
    </div>
  );
}
