import { useEffect, useMemo, useRef, useState } from 'react';
import { importLibrary } from '@googlemaps/js-api-loader';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '../../../shared/ui/primitives';
import { configureGoogleMapsLoader } from '../services/googleMapsLoader';

export interface PinValue {
  latitude?: number;
  longitude?: number;
  placeId?: string;
  standardizedAddress?: string;
}

interface ManualPinMapProps {
  value: PinValue;
  address?: string;
  utilityProvider?: string;
  onChange: (value: PinValue) => void;
}

const defaultCenter = { lat: 14.5995, lng: 120.9842 };

function formatCoordinate(value?: number) {
  return typeof value === 'number' ? value.toFixed(6) : '';
}

export function ManualPinMap({ value, address, utilityProvider, onChange }: ManualPinMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback' | 'error'>('idle');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [manualLat, setManualLat] = useState(formatCoordinate(value.latitude));
  const [manualLng, setManualLng] = useState(formatCoordinate(value.longitude));
  const browserKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined;

  const center = useMemo(() => {
    if (typeof value.latitude === 'number' && typeof value.longitude === 'number') {
      return { lat: value.latitude, lng: value.longitude };
    }
    return defaultCenter;
  }, [value.latitude, value.longitude]);

  function commitPinValue(next: PinValue, message?: string) {
    if (typeof next.latitude === 'number') setManualLat(formatCoordinate(next.latitude));
    if (typeof next.longitude === 'number') setManualLng(formatCoordinate(next.longitude));
    if (mapInstanceRef.current && markerRef.current && typeof next.latitude === 'number' && typeof next.longitude === 'number') {
      const position = { lat: next.latitude, lng: next.longitude };
      mapInstanceRef.current.panTo(position);
      markerRef.current.position = position;
    }
    onChange(next);
    setError('');
    if (message) setNotice(message);
  }

  useEffect(() => {
    setManualLat(formatCoordinate(value.latitude));
    setManualLng(formatCoordinate(value.longitude));
  }, [value.latitude, value.longitude]);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!browserKey) {
        setStatus('fallback');
        setError('Google Maps browser key is not configured. Enter the pin manually.');
        return;
      }
      if (!mapRef.current) return;

      try {
        setStatus('loading');
        configureGoogleMapsLoader(browserKey);
        const { Map } = await importLibrary('maps') as google.maps.MapsLibrary;
        const { AdvancedMarkerElement, PinElement } = await importLibrary('marker') as google.maps.MarkerLibrary;
        if (cancelled || !mapRef.current) return;

        const map = new Map(mapRef.current, {
          center,
          zoom: value.latitude && value.longitude ? 19 : 12,
          mapTypeId: google.maps.MapTypeId.HYBRID,
          mapId: 'DEMO_MAP_ID',
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: false,
        });
        mapInstanceRef.current = map;

        const pin = new PinElement({
          background: '#0f766e',
          borderColor: '#115e59',
          glyphColor: '#ffffff',
        });
        markerRef.current = new AdvancedMarkerElement({
          map,
          position: value.latitude && value.longitude ? center : undefined,
          content: pin,
          gmpDraggable: true,
          title: 'Confirmed solar roof pin',
        });

        function commitPin(latLng: google.maps.LatLng) {
          const next = { latitude: latLng.lat(), longitude: latLng.lng() };
          commitPinValue(next, 'Pin updated from map click.');
        }

        map.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (event.latLng) commitPin(event.latLng);
        });
        markerRef.current.addListener('dragend', (event: google.maps.MapMouseEvent) => {
          if (event.latLng) commitPin(event.latLng);
        });

        setStatus('ready');
        setError('');
      } catch (caught) {
        setStatus('error');
        setError(caught instanceof Error ? caught.message : 'Google Maps failed to load. Enter the pin manually.');
      }
    }

    initMap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    if (typeof value.latitude !== 'number' || typeof value.longitude !== 'number') return;
    const position = { lat: value.latitude, lng: value.longitude };
    mapInstanceRef.current.panTo(position);
    markerRef.current.position = position;
  }, [value.latitude, value.longitude]);

  async function geocodeAddress() {
    if (!browserKey || !address?.trim()) return;
    try {
      setStatus('loading');
      setError('');
      setNotice('');
      configureGoogleMapsLoader(browserKey);
      const { Geocoder } = await importLibrary('geocoding') as google.maps.GeocodingLibrary;
      const geocoder = new Geocoder();
      const result = await geocoder.geocode({ address, componentRestrictions: { country: 'PH' } });
      const fallbackResult = result.results.length
        ? result
        : await geocoder.geocode({ address: `${address}, Philippines`, componentRestrictions: { country: 'PH' } });
      const match = fallbackResult.results[0];
      if (!match?.geometry.location) {
        setStatus('error');
        setError('No Google Maps result matched this address. Drop the pin manually.');
        return;
      }
      const next = {
        latitude: match.geometry.location.lat(),
        longitude: match.geometry.location.lng(),
        placeId: match.place_id,
        standardizedAddress: match.formatted_address,
      };
      commitPinValue(next, 'Address matched and pin updated.');
      setStatus('ready');
      setError('');
    } catch (caught) {
      setStatus('error');
      setError(caught instanceof Error ? caught.message : 'Address lookup failed. Drop the pin manually.');
    }
  }

  function useDeviceLocation() {
    if (isLocating) return;
    if (!navigator.geolocation) {
      setStatus('fallback');
      setError('This browser does not expose device location. Enter the pin manually.');
      return;
    }
    if (!window.isSecureContext) {
      setStatus('fallback');
      setError('Device location requires a secure browser context. Use localhost/HTTPS or enter the pin manually.');
      return;
    }
    setIsLocating(true);
    setNotice('Requesting device location...');
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        commitPinValue(
          { latitude: position.coords.latitude, longitude: position.coords.longitude },
          `Device location applied. Accuracy: ${Math.round(position.coords.accuracy)}m.`,
        );
        setIsLocating(false);
        setError('');
      },
      (geoError) => {
        setIsLocating(false);
        setStatus('fallback');
        setNotice('');
        const reason = geoError.code === geoError.PERMISSION_DENIED
          ? 'Location permission was denied.'
          : geoError.code === geoError.TIMEOUT
            ? 'Device location timed out.'
            : 'Device location was not available.';
        setError(`${reason} Enter the pin manually or click the map.`);
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 15000 },
    );
  }

  function applyManualPin() {
    const latitude = Number(manualLat);
    const longitude = Number(manualLng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setError('Latitude and longitude must be valid numbers.');
      return;
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setError('Latitude must be between -90 and 90; longitude must be between -180 and 180.');
      return;
    }
    commitPinValue({ latitude, longitude }, 'Manual coordinates applied.');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Manual Solar Snapshot pin</p>
          <p className="text-sm text-muted-foreground">Click or drag the marker to lock the exact rooftop before running Solar Snapshot.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={value.latitude && value.longitude ? 'success' : 'warning'}>
            {value.latitude && value.longitude ? 'Pin confirmed' : 'Pin required'}
          </Badge>
          {utilityProvider ? <Badge tone="info">{utilityProvider}</Badge> : null}
        </div>
      </div>

      {error ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTitle>Map review needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {!error && notice ? (
        <Alert className="border-sky-200 bg-sky-50 text-sky-900">
          <AlertTitle>Location update</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button disabled={!browserKey || !address?.trim()} size="sm" variant="outline" onClick={geocodeAddress}>
          <Search className="size-4" />
          Find address
        </Button>
        <Button disabled={isLocating} size="sm" variant="outline" onClick={useDeviceLocation}>
          <LocateFixed className="size-4" />
          {isLocating ? 'Locating...' : 'Use device location'}
        </Button>
      </div>

      <div className="relative min-h-80 overflow-hidden rounded-lg border bg-muted">
        <div ref={mapRef} className="absolute inset-0" />
        {status === 'loading' ? <div className="absolute inset-0 grid place-items-center bg-background/80 text-sm">Loading map...</div> : null}
        {(status === 'fallback' || status === 'error' || !browserKey) ? (
          <div className="absolute inset-0 grid place-items-center bg-background/90 p-4 text-center text-sm text-muted-foreground">
            <div>
              <MapPin className="mx-auto mb-2 size-5" />
              Enter coordinates below or configure `VITE_GOOGLE_MAPS_BROWSER_KEY`.
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor="manual-latitude">Latitude</Label>
          <Input id="manual-latitude" inputMode="decimal" value={manualLat} onChange={(event) => setManualLat(event.target.value)} placeholder="14.599512" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-longitude">Longitude</Label>
          <Input id="manual-longitude" inputMode="decimal" value={manualLng} onChange={(event) => setManualLng(event.target.value)} placeholder="120.984222" />
        </div>
        <div className="flex items-end">
          <Button className="w-full sm:w-auto" variant="outline" onClick={applyManualPin}>Apply pin</Button>
        </div>
      </div>
    </div>
  );
}
