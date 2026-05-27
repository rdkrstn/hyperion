import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge, Info } from '../../../shared/ui/primitives';
import type { ActionResult } from '../../../shared/types/app';
import type { SolarSnapshot } from '../types';

interface PanelLayoutBuilderProps {
  snapshot: SolarSnapshot;
  onApply: (input: { panelCount: number; panelCapacityWatts?: number }) => ActionResult<SolarSnapshot>;
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function PanelLayoutBuilder({ snapshot, onApply }: PanelLayoutBuilderProps) {
  const [panelCount, setPanelCount] = useState(String(snapshot.selectedPanelCount));
  const [panelCapacityWatts, setPanelCapacityWatts] = useState(String(snapshot.panelCapacityWatts));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setPanelCount(String(snapshot.selectedPanelCount));
    setPanelCapacityWatts(String(snapshot.panelCapacityWatts));
  }, [snapshot.id, snapshot.selectedPanelCount, snapshot.panelCapacityWatts]);

  const requestedPanels = toNumber(panelCount);
  const watts = toNumber(panelCapacityWatts);
  const cappedPanels = Math.max(0, Math.min(snapshot.maxPanels, Math.round(requestedPanels)));
  const selectedKwp = Number(((cappedPanels * watts) / 1000).toFixed(2));
  const annualProduction = Math.round(selectedKwp * 1450);
  const atRoofLimit = snapshot.maxPanels > 0 && cappedPanels >= snapshot.maxPanels;
  const overRoofLimit = requestedPanels > snapshot.maxPanels;
  const canApply = snapshot.status === 'ready' && snapshot.maxPanels > 0 && watts > 0;

  const recommendation = useMemo(() => {
    if (snapshot.status !== 'ready') return 'Run Solar Snapshot before adjusting panels.';
    if (overRoofLimit) return `Requested panels exceed the Solar Snapshot roof cap. The layout will be capped at ${snapshot.maxPanels} panels.`;
    if (atRoofLimit) return 'The selected layout uses the full roof capacity from Solar Snapshot.';
    return 'Adjust panels here before this becomes a formal proposal scope.';
  }, [atRoofLimit, overRoofLimit, snapshot.maxPanels, snapshot.status]);

  function adjust(delta: number) {
    const next = Math.max(0, Math.min(snapshot.maxPanels, Math.round(requestedPanels) + delta));
    setPanelCount(String(next));
    setMessage('');
    setError('');
  }

  function apply() {
    setMessage('');
    setError('');
    if (!canApply) {
      setError('Solar Snapshot must be ready and panel wattage must be valid before applying a layout.');
      return;
    }
    const result = onApply({ panelCount: requestedPanels, panelCapacityWatts: watts });
    if (result.ok) {
      setMessage(result.message ?? 'Panel layout updated.');
    } else {
      setError(result.error ?? 'Unable to update panel layout.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Panel allocation</p>
          <p className="text-sm text-muted-foreground">Add or remove panels within the roof maximum before building the formal proposal.</p>
        </div>
        <Badge tone={atRoofLimit ? 'warning' : 'info'}>{cappedPanels}/{snapshot.maxPanels} panels</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Info label="Roof max" value={`${snapshot.roofCapacityKwp} kWp`} />
        <Info label="Selected size" value={`${selectedKwp} kWp`} />
        <Info label="Panel wattage" value={`${watts || 0} W`} />
        <Info label="Production est." value={`${annualProduction.toLocaleString()} kWh/yr`} />
      </div>

      <Alert className={overRoofLimit ? 'border-amber-200 bg-amber-50 text-amber-900' : ''}>
        <AlertTitle>{overRoofLimit ? 'Roof cap applied' : 'Draft layout guidance'}</AlertTitle>
        <AlertDescription>{recommendation}</AlertDescription>
      </Alert>

      {message ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertTitle>Cannot update panel layout</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor={`panel-count-${snapshot.id}`}>Selected panels</Label>
          <div className="grid grid-cols-[auto_1fr_auto] gap-2">
            <Button type="button" variant="outline" onClick={() => adjust(-1)} disabled={!canApply || cappedPanels <= 0} aria-label="Remove one panel">
              <Minus className="size-4" />
            </Button>
            <Input
              id={`panel-count-${snapshot.id}`}
              inputMode="numeric"
              min={0}
              max={snapshot.maxPanels}
              type="number"
              value={panelCount}
              onChange={(event) => setPanelCount(event.target.value)}
            />
            <Button type="button" variant="outline" onClick={() => adjust(1)} disabled={!canApply || atRoofLimit} aria-label="Add one panel">
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`panel-watts-${snapshot.id}`}>Panel watts</Label>
          <Input
            id={`panel-watts-${snapshot.id}`}
            inputMode="numeric"
            min={1}
            type="number"
            value={panelCapacityWatts}
            onChange={(event) => setPanelCapacityWatts(event.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button className="w-full md:w-auto" disabled={!canApply} onClick={apply}>Apply layout</Button>
        </div>
      </div>
    </div>
  );
}
