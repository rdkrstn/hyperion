import { useEffect, useMemo, useRef, useState } from 'react';
import { importLibrary } from '@googlemaps/js-api-loader';
import { Grid3X3, MapPinned, PanelTop, SunMedium, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge, Info } from '../../../shared/ui/primitives';
import type { ActionResult } from '../../../shared/types/app';
import type { SolarSnapshot, SolarWorkbenchMode } from '../types';
import { configureGoogleMapsLoader } from '../services/googleMapsLoader';
import { buildRoofOverlayBounds, buildRoofVisualPanelSlots, getPanelGeometrySource, heatColor, selectedProductionFromPanels } from '../services/solarVisualEditor';

interface SolarWorkbenchProps {
  snapshot: SolarSnapshot;
  mode?: SolarWorkbenchMode;
  onApply?: (input: { panelCount: number; panelCapacityWatts?: number }) => ActionResult<SolarSnapshot>;
}

function formatNumber(value?: number) {
  return Number(value ?? 0).toLocaleString();
}

function buildGoogleGeometrySvg(snapshot: SolarSnapshot, bounds: ReturnType<typeof buildRoofOverlayBounds>) {
  const selected = snapshot.selectedPanelCount;
  const latSpan = Math.max(0.000001, bounds.north - bounds.south);
  const lngSpan = Math.max(0.000001, bounds.east - bounds.west);
  const panels = (snapshot.panelPlacements ?? [])
    .filter((placement) => Number.isFinite(placement.center?.latitude) && Number.isFinite(placement.center?.longitude))
    .slice(0, snapshot.maxPanels)
    .map((placement, index) => {
      const x = ((placement.center!.longitude - bounds.west) / lngSpan) * 100;
      const y = ((bounds.north - placement.center!.latitude) / latSpan) * 100;
      const landscape = placement.orientation !== 'PORTRAIT';
      const width = landscape ? 5.8 : 4.2;
      const height = landscape ? 3.8 : 6.2;
      const heatScore = Math.max(45, 98 - index * 2);
      return `
      <rect
        data-panel-index="${index}"
        x="${x - width / 2}"
        y="${y - height / 2}"
        width="${width}"
        height="${height}"
        rx="0.9"
        fill="${index < selected ? '#2563eb' : heatColor(heatScore)}"
        fill-opacity="${index < selected ? '0.88' : '0.36'}"
        stroke="${index < selected ? '#bfdbfe' : 'rgba(255,255,255,0.74)'}"
        stroke-width="0.45"
      />`;
    }).join('');
  return `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;overflow:visible">
      ${panels}
      <circle cx="50" cy="50" r="1.8" fill="#ef4444" stroke="white" stroke-width="0.8" />
    </svg>
  `;
}

function buildEstimatedGeometrySvg(snapshot: SolarSnapshot) {
  const selected = snapshot.selectedPanelCount;
  const slots = buildRoofVisualPanelSlots(snapshot).slice(0, snapshot.maxPanels);
  const panels = slots.map((slot) => `
    <rect
      data-panel-index="${slot.index}"
      x="${slot.x}"
      y="${slot.y}"
      width="${slot.width}"
      height="${slot.height}"
      rx="1.1"
      fill="${slot.index < selected ? '#2563eb' : heatColor(slot.heatScore)}"
      fill-opacity="${slot.index < selected ? '0.9' : '0.42'}"
      stroke="${slot.index < selected ? '#dbeafe' : 'rgba(255,255,255,0.78)'}"
      stroke-width="0.5"
    />`).join('');
  return `
    <svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;overflow:visible">
      <g transform="rotate(-6 50 35)">
        ${panels}
      </g>
      <circle cx="50" cy="35" r="1.8" fill="#ef4444" stroke="white" stroke-width="0.8" />
    </svg>
  `;
}

function buildPanelGeometrySvg(snapshot: SolarSnapshot, bounds: ReturnType<typeof buildRoofOverlayBounds>, geometrySource: ReturnType<typeof getPanelGeometrySource>) {
  if (geometrySource === 'google_building_insights') return buildGoogleGeometrySvg(snapshot, bounds);
  if (geometrySource === 'local_estimate') return buildEstimatedGeometrySvg(snapshot);
  return '';
}

export function SolarWorkbench({ snapshot, mode = 'compact', onApply }: SolarWorkbenchProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const overlayDivRef = useRef<HTMLDivElement | null>(null);
  const browserKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const [showPanels, setShowPanels] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [mapError, setMapError] = useState('');
  const bounds = useMemo(() => buildRoofOverlayBounds(snapshot), [snapshot]);
  const geometrySource = getPanelGeometrySource(snapshot);
  const hasGoogleGeometry = geometrySource === 'google_building_insights';
  const hasRenderableGeometry = geometrySource !== 'missing';
  const selectedEnergy = selectedProductionFromPanels(snapshot, snapshot.selectedPanelCount);
  const selectedPercent = snapshot.maxPanels ? Math.round((snapshot.selectedPanelCount / snapshot.maxPanels) * 100) : 0;
  const canEdit = mode !== 'readonly' && snapshot.status === 'ready' && snapshot.maxPanels > 0 && Boolean(onApply);
  const isFull = mode === 'full';

  function applyPanelCount(panelCount: number) {
    setMessage('');
    setError('');
    if (!canEdit || !onApply) {
      setError('Run Solar Snapshot before editing the roof panel layout.');
      return;
    }
    const result = onApply({ panelCount, panelCapacityWatts: snapshot.panelCapacityWatts });
    if (result.ok) setMessage(result.message ?? 'Solar array updated.');
    else setError(result.error ?? 'Unable to update Solar array.');
  }

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!browserKey || !mapRef.current || !snapshot.latitude || !snapshot.longitude) return;
      try {
        configureGoogleMapsLoader(browserKey);
        const { Map, OverlayView } = await importLibrary('maps') as google.maps.MapsLibrary;
        if (cancelled || !mapRef.current) return;
        const center = { lat: snapshot.latitude, lng: snapshot.longitude };
        const map = new Map(mapRef.current, {
          center,
          zoom: isFull ? 21 : 20,
          mapTypeId: google.maps.MapTypeId.SATELLITE,
          disableDefaultUI: true,
          gestureHandling: isFull ? 'greedy' : 'cooperative',
          keyboardShortcuts: true,
        });
        mapInstanceRef.current = map;
        map.fitBounds(new google.maps.LatLngBounds(
          new google.maps.LatLng(bounds.south, bounds.west),
          new google.maps.LatLng(bounds.north, bounds.east),
        ), 80);

        if (!hasRenderableGeometry || !showPanels) return;

        const overlay = new OverlayView();
        overlay.onAdd = () => {
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.transformOrigin = 'center center';
          div.style.pointerEvents = canEdit ? 'auto' : 'none';
          div.innerHTML = buildPanelGeometrySvg(snapshot, bounds, geometrySource);
          div.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            const rawIndex = target.getAttribute('data-panel-index');
            if (!rawIndex) return;
            const index = Number(rawIndex);
            const next = index < snapshot.selectedPanelCount
              ? Math.max(0, snapshot.selectedPanelCount - 1)
              : Math.min(snapshot.maxPanels, snapshot.selectedPanelCount + 1);
            applyPanelCount(next);
          });
          overlayDivRef.current = div;
          overlay.getPanes()?.overlayMouseTarget.appendChild(div);
        };
        overlay.draw = () => {
          const projection = overlay.getProjection();
          const div = overlayDivRef.current;
          if (!projection || !div) return;
          const sw = projection.fromLatLngToDivPixel(new google.maps.LatLng(bounds.south, bounds.west));
          const ne = projection.fromLatLngToDivPixel(new google.maps.LatLng(bounds.north, bounds.east));
          if (!sw || !ne) return;
          div.style.left = `${sw.x}px`;
          div.style.top = `${ne.y}px`;
          div.style.width = `${Math.max(20, ne.x - sw.x)}px`;
          div.style.height = `${Math.max(20, sw.y - ne.y)}px`;
        };
        overlay.onRemove = () => {
          overlayDivRef.current?.remove();
          overlayDivRef.current = null;
        };
        overlay.setMap(map);
        overlayRef.current = overlay;
      } catch (caught) {
        setMapError(caught instanceof Error ? caught.message : 'Google satellite map could not load.');
      }
    }

    initMap();
    return () => {
      cancelled = true;
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
    };
  }, [browserKey, bounds, canEdit, geometrySource, hasRenderableGeometry, isFull, showPanels, snapshot]);

  useEffect(() => {
    if (overlayDivRef.current) {
      overlayDivRef.current.innerHTML = hasRenderableGeometry && showPanels ? buildPanelGeometrySvg(snapshot, bounds, geometrySource) : '';
      overlayDivRef.current.style.pointerEvents = canEdit ? 'auto' : 'none';
    }
  }, [bounds, canEdit, geometrySource, hasRenderableGeometry, showPanels, snapshot]);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="grid gap-0 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Roof cap" value={`${snapshot.roofCapacityKwp} kWp`} />
            <Info label="Selected panels" value={`${snapshot.selectedPanelCount}/${snapshot.maxPanels}`} />
            <Info label="Selected size" value={`${snapshot.selectedSystemSizeKwp} kWp`} />
            <Info label="Production" value={`${formatNumber(selectedEnergy)} kWh/yr`} />
          </div>

          <div className={cn('relative overflow-hidden rounded-xl border bg-slate-950', isFull ? 'min-h-[620px]' : 'min-h-[420px]')}>
            <div ref={mapRef} className="absolute inset-0" />
            {!browserKey || !snapshot.latitude || !snapshot.longitude ? (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_20%,rgba(59,130,246,0.24),transparent_24%),radial-gradient(circle_at_60%_45%,rgba(249,115,22,0.32),transparent_32%),linear-gradient(135deg,#0f172a,#334155)]" />
            ) : null}
            <div className="absolute left-3 top-3 flex flex-wrap gap-2 rounded-xl bg-white/92 p-2 text-xs shadow-sm backdrop-blur">
              <button type="button" className={cn('rounded-lg px-3 py-1.5', showPanels && hasRenderableGeometry && 'bg-slate-900 text-white')} disabled={!hasRenderableGeometry} onClick={() => setShowPanels((value) => !value)}>Panels</button>
              <span className={cn('rounded-lg px-3 py-1.5', hasGoogleGeometry ? 'bg-emerald-50 text-emerald-700' : geometrySource === 'local_estimate' ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800')}>
                {hasGoogleGeometry ? 'Google panel geometry' : geometrySource === 'local_estimate' ? 'Estimated panel layout' : 'No panel geometry'}
              </span>
            </div>
            <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-white/94 p-3 shadow-sm backdrop-blur md:right-auto md:w-[440px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">Roof layout review</p>
                  <p className="text-sm text-muted-foreground">
                    {hasGoogleGeometry ? 'Panels are positioned from Google Building Insights.' : geometrySource === 'local_estimate' ? 'Estimated array is based on roof cap and selected panel count.' : 'Panel count is editable after Solar Snapshot returns geometry or a local estimate.'}
                  </p>
                </div>
                <Badge tone={snapshot.status === 'ready' ? 'success' : 'warning'}>{snapshot.status}</Badge>
              </div>
            </div>
            {mapError ? <div className="absolute right-3 top-3 max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{mapError}</div> : null}
          </div>
        </div>

        <aside className="border-t bg-white p-4 xl:border-l xl:border-t-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Solar roof review</p>
              <p className="text-sm text-muted-foreground">Proposal sizing controls</p>
            </div>
            <Badge tone={snapshot.status === 'ready' ? 'success' : 'warning'}>{snapshot.imageryQuality}</Badge>
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="flex items-center gap-2 text-sm"><SunMedium className="size-4 text-blue-600" />Sunshine</span>
              <span className="font-semibold">{formatNumber(snapshot.sunshineHoursPerYear)} hrs/yr</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="flex items-center gap-2 text-sm"><PanelTop className="size-4 text-blue-600" />Roof area</span>
              <span className="font-semibold">{formatNumber(snapshot.roofAreaM2)} m2</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="flex items-center gap-2 text-sm"><Grid3X3 className="size-4 text-blue-600" />Max panels</span>
              <span className="font-semibold">{snapshot.maxPanels}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="flex items-center gap-2 text-sm"><Zap className="size-4 text-blue-600" />Output</span>
              <span className="font-semibold">{formatNumber(selectedEnergy)} kWh/yr</span>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Panel count</span>
              <span className="font-semibold">{snapshot.selectedPanelCount}/{snapshot.maxPanels}</span>
            </div>
            <input
              type="range"
              min={0}
              max={snapshot.maxPanels}
              step={1}
              value={snapshot.selectedPanelCount}
              disabled={!canEdit}
              onChange={(event) => applyPanelCount(Number(event.target.value))}
              className="range range-primary range-sm"
            />
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${selectedPercent}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{snapshot.selectedSystemSizeKwp} kWp selected from {snapshot.roofCapacityKwp} kWp roof cap.</p>
          </div>

          {message ? <Alert className="mt-4 border-emerald-200 bg-emerald-50 text-emerald-900"><AlertDescription>{message}</AlertDescription></Alert> : null}
          {error ? <Alert className="mt-4 border-red-200 bg-red-50 text-red-900"><AlertDescription>{error}</AlertDescription></Alert> : null}

          {mode !== 'full' ? (
            <Button asChild className="mt-5 w-full" variant="outline">
              <Link to={`/solar-snapshots/${snapshot.id}`}>
                <MapPinned className="size-4" />
                Open full workbench
              </Link>
            </Button>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
