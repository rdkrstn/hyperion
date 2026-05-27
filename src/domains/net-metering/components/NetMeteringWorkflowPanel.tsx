import { Badge, EmptyState, Panel } from '../../../shared/ui/primitives';
import { titleize } from '../../../shared/utils/format';
import type { NetMeteringWorkflowView } from '../types';

interface NetMeteringWorkflowPanelProps {
  view?: NetMeteringWorkflowView;
  title?: string;
  compact?: boolean;
}

function tone(status: string) {
  if (status === 'complete') return 'success' as const;
  if (status === 'blocked') return 'error' as const;
  if (status === 'in_progress') return 'warning' as const;
  return 'neutral' as const;
}

export function NetMeteringWorkflowPanel({ view, title = 'Net-metering workflow', compact = false }: NetMeteringWorkflowPanelProps) {
  if (!view) return <Panel title={title}><EmptyState text="Select a deal to review net-metering status." /></Panel>;

  return (
    <Panel title={title} action={<Badge tone={view.readyForProposal ? 'success' : 'warning'}>{view.readyForProposal ? 'Ready for proposal' : 'Blocked'}</Badge>}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{view.nextAction}</p>
        <div className={compact ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'grid gap-3 lg:grid-cols-3'}>
          {view.steps.map((step, index) => (
            <div key={step.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Step {index + 1}</p>
                  <p className="font-semibold">{step.title}</p>
                </div>
                <Badge tone={tone(step.status)}>{titleize(step.status)}</Badge>
              </div>
              <p className="mt-3 text-sm font-medium">{step.customerLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">{step.staffLabel}</p>
              {step.slaBadge ? <div className="mt-3"><Badge tone="success">{step.slaBadge}</Badge></div> : null}
              {step.blockers.length ? (
                <div className="mt-3 space-y-1">
                  {step.blockers.map((blocker) => <p key={blocker} className="text-xs text-destructive">{blocker}</p>)}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
