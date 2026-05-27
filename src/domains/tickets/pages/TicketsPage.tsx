import { EmptyState, PageHeader, Panel } from '../../../shared/ui/primitives';

export function TicketsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Tickets" description="Aftersales and support task tracking after proposal acceptance or installation." />
      <Panel>
        <EmptyState text="No tickets yet. Tickets are for support, docs, survey blockers, and aftersales follow-up." />
      </Panel>
    </div>
  );
}
