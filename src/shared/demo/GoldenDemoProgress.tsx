import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, CircleDot, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Info } from '../ui/primitives';
import { php } from '../utils/format';
import type { GoldenDemoModel } from './goldenDemo';
import type { ActionResult } from '../types/app';

interface GoldenDemoProgressProps {
  model: GoldenDemoModel;
  onLoad: () => ActionResult;
  onRunNext: () => ActionResult;
  compact?: boolean;
}

export function GoldenDemoProgress({ model, onLoad, onRunNext, compact = false }: GoldenDemoProgressProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={model.loaded ? 'success' : 'warning'}>{model.loaded ? 'Golden demo loaded' : 'Demo not loaded'}</Badge>
            <Badge tone="info">Hyperion v1.0.0</Badge>
          </div>
          <h2 className="mt-3 text-xl font-semibold">Iloilo Mini Mart golden path</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Follow one commercial solar buyer from qualified lead through Solar Snapshot, documents, survey, proposal, net-metering readiness, and contract-ready handoff.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onLoad}>
            <Sparkles className="size-4" />
            Load golden demo
          </Button>
          <Button onClick={onRunNext}>{model.nextAction}</Button>
          <Button asChild variant="ghost">
            <Link to="/workbench">
              View workbench
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Demo progress</span>
          <span>{model.progressPercent}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-muted">
          <div className="h-2 rounded-full bg-amber-500" style={{ width: `${model.progressPercent}%` }} />
        </div>
      </div>

      {!compact ? (
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Info label="Readiness" value={`${model.metrics.readinessScore}/100`} />
          <Info label="Monthly bill" value={php.format(model.metrics.monthlyBill)} />
          <Info label="Solar Snapshot" value={`${model.metrics.selectedPanels}/${model.metrics.maxPanels} panels`} />
          <Info label="Proposal value" value={php.format(model.metrics.proposalValue)} />
        </div>
      ) : null}

      <div className="mt-5 grid gap-2 md:grid-cols-3 xl:grid-cols-9">
        {model.steps.map((step) => (
          <div key={step.id} className="rounded-lg border bg-muted/30 p-2">
            <div className="flex items-center gap-2">
              {step.status === 'complete' ? <CheckCircle2 className="size-4 text-emerald-600" /> : <CircleDot className="size-4 text-muted-foreground" />}
              <span className="text-xs font-medium">{step.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
