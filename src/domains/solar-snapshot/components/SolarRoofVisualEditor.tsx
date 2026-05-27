import { useEffect, useMemo, useRef, useState } from 'react';
import { importLibrary } from '@googlemaps/js-api-loader';
import { Minus, Plus, SunMedium } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge, Info } from '../../../shared/ui/primitives';
import type { ActionResult } from '../../../shared/types/app';
import type { SolarSnapshot } from '../types';
import { configureGoogleMapsLoader } from '../services/googleMapsLoader';
import { buildRoofVisualPanelSlots, heatColor, nextPanelCountFromVisualClick } from '../services/solarVisualEditor';

interface SolarRoofVisualEditorProps {
  snapshot: SolarSnapshot;
  onApply: (input: { panelCount: number; panelCapacityWatts?: number }) => ActionResult<SolarSnapshot>;
}

export function SolarRoofVisualEditor({ snapshot, onApply }: SolarRoofVisualEditorProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const browserKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const slots = useMemo(() => buildRoofVisualPanelSlots(snapshot), [snapshot]);
  const heatId = `solar-heat-${snapshot.id}`;
  const clipId = `solar-roof-${snapshot.id}`;
  const canEdit = snapshot.status === 'ready' && snapshot.maxPanels > 0;

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!browserKey || !mapRef.current || !snapshot.latitude || !snapshot.longitude) return;
      try {
        configureGoogleMapsLoader(browserKey);
        const { Map } = await importLibrary('maps') as google.maps.MapsLibrary;
        if (cancelled || !mapRef.current) return;
        const center = { lat: snapshot.latitude, lng: snapshot.longitude };
        mapInstanceRef.current = new Map(mapRef.current, {
          center,
          zoom: 20,
          mapTypeId: google.maps.MapTypeId.HYBRID,
          disableDefaultUI: true,
          gestureHandling: 'none',
          keyboardShortcuts: false,
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Google satellite layer could not load.');
      }
    }

    initMap();
    return () => {
      cancelled = true;
    };
  }, [browserKey, snapshot.latitude, snapshot.longitude]);

  useEffect(() => {
    if (!mapInstanceRef.current || !snapshot.latitude || !snapshot.longitude) return;
    mapInstanceRef.current.panTo({ lat: snapshot.latitude, lng: snapshot.longitude });
  }, [snapshot.latitude, snapshot.longitude]);

  function applyPanelCount(panelCount: number) {
    setMessage('');
    setError('');
    if (!canEdit) {
      setError('Run Solar Snapshot before editing the roof panel layout.');
      return;
    }
    const result = onApply({ panelCount, panelCapacityWatts: snapshot.panelCapacityWatts });
    if (result.ok) setMessage(result.message ?? 'Roof panel layout updated.');
    else setError(result.error ?? 'Unable to update panel layout.');
  }

  function handleSlotClick(slotIndex: number) {
    applyPanelCount(nextPanelCountFromVisualClick(snapshot, slotIndex));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">Solar roof visual editor</p>
          <p className="text-sm text-muted-foreground">Satellite view, roof mask, irradiance heat, and clickable panel slots from the current Solar Snapshot.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={snapshot.status === 'ready' ? 'success' : 'warning'}>{snapshot.status}</Badge>
          <Badge tone="info">{snapshot.selectedPanelCount}/{snapshot.maxPanels} panels</Badge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Info label="Selected size" value={`${snapshot.selectedSystemSizeKwp} kWp`} />
        <Info label="Roof max" value={`${snapshot.roofCapacityKwp} kWp`} />
        <Info label="Panel watts" value={`${snapshot.panelCapacityWatts} W`} />
        <Info label="Production est." value={`${snapshot.annualProductionKwh.toLocaleString()} kWh/yr`} />
      </div>

      <div className="relative min-h-[360px] overflow-hidden rounded-xl border bg-slate-950">
        <div ref={mapRef} className="absolute inset-0 opacity-95" />
        {!browserKey || !snapshot.latitude || !snapshot.longitude ? (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_20%,rgba(34,197,94,0.24),transparent_25%),radial-gradient(circle_at_60%_45%,rgba(249,115,22,0.28),transparent_30%),linear-gradient(135deg,#0f172a,#1f2937)]" />
        ) : null}
        <div className="absolute inset-0 bg-black/10" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 70" preserveAspectRatio="xMidYMid meet" aria-label="Solar roof mask and panel placement editor">
          <defs>
            <linearGradient id={heatId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.92" />
              <stop offset="42%" stopColor="#f97316" stopOpacity="0.78" />
              <stop offset="68%" stopColor="#facc15" stopOpacity="0.72" />
              <stop offset="100%" stopColor="#84cc16" stopOpacity="0.62" />
            </linearGradient>
            <clipPath id={clipId}>
              <polygon points="17,10 71,8 89,28 82,58 32,63 10,40" />
            </clipPath>
          </defs>
          <polygon points="17,10 71,8 89,28 82,58 32,63 10,40" fill="rgba(15,23,42,0.38)" stroke="white" strokeOpacity="0.9" strokeWidth="0.7" />
          <rect x="8" y="6" width="84" height="60" fill={`url(#${heatId})`} clipPath={`url(#${clipId})`} opacity="0.62" />
          <polygon points="17,10 71,8 89,28 82,58 32,63 10,40" fill="none" stroke="#22d3ee" strokeWidth="0.5" strokeDasharray="1.5 1.5" />
          {slots.map((slot) => (
            <g key={slot.index} role="button" tabIndex={0} aria-label={`${slot.selected ? 'Remove' : 'Add'} panel slot ${slot.index + 1}`} onClick={() => handleSlotClick(slot.index)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') handleSlotClick(slot.index); }}>
              <rect
                x={slot.x}
                y={slot.y}
                width={slot.width}
                height={slot.height}
                rx="0.8"
                fill={slot.selected ? '#0f766e' : heatColor(slot.heatScore)}
                fillOpacity={slot.selected ? 0.96 : 0.52}
                stroke={slot.selected ? '#ccfbf1' : 'rgba(255,255,255,0.75)'}
                strokeWidth={slot.selected ? 0.45 : 0.25}
                className="cursor-pointer transition hover:opacity-100"
              />
              <text x={slot.x + slot.width / 2} y={slot.y + slot.height / 2 + 1.2} textAnchor="middle" fontSize="2.5" fill={slot.selected ? '#ecfeff' : '#111827'}>{slot.index + 1}</text>
            </g>
          ))}
        </svg>
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/92 p-3 text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <SunMedium className="size-4 text-orange-500" />
            <span className="font-medium">Irradiance heat index</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Lower</span>
            <span className="h-2 w-24 rounded-full bg-gradient-to-r from-lime-400 via-yellow-400 via-orange-500 to-red-500" />
            <span>Higher</span>
          </div>
        </div>
      </div>

      {message ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertTitle>Layout saved</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTitle>Visual editor needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" disabled={!canEdit || snapshot.selectedPanelCount <= 0} onClick={() => applyPanelCount(snapshot.selectedPanelCount - 1)}>
          <Minus className="size-4" />
          Remove panel
        </Button>
        <Button disabled={!canEdit || snapshot.selectedPanelCount >= snapshot.maxPanels} onClick={() => applyPanelCount(snapshot.selectedPanelCount + 1)}>
          <Plus className="size-4" />
          Add panel
        </Button>
      </div>
    </div>
  );
}
