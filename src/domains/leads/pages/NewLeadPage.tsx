import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSolarOps } from '../../../shared/api/SolarOpsProvider';
import { PageHeader, Panel } from '../../../shared/ui/primitives';
import type { LeadGoal, LeadInput, LeadSource, SiteControl } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ManualPinMap, type PinValue } from '../../solar-snapshot/components/ManualPinMap';
import { formatPinnedLocation, hasConfirmedPin } from '../services/leadService';

const defaultLead: LeadInput = {
  businessName: '',
  contactName: '',
  phone: '',
  source: 'd2d',
  location: '',
  utilityProvider: '',
  monthlyBill: 0,
  monthlyKwh: undefined,
  goal: 'lower_bill',
  siteControl: 'unknown',
  assignedSales: 'sales-1',
  daytimeUsage: 'medium',
};

export function NewLeadPage() {
  const { actions } = useSolarOps();
  const [form, setForm] = useState<LeadInput>(defaultLead);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  function patch<T extends keyof LeadInput>(key: T, value: LeadInput[T]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function numberValue(value: string) {
    return value.trim() ? Number(value) : 0;
  }

  function optionalNumberValue(value: string) {
    return value.trim() ? Number(value) : undefined;
  }

  function patchPin(pin: PinValue) {
    setForm((current) => ({
      ...current,
      latitude: pin.latitude,
      longitude: pin.longitude,
      placeId: pin.placeId ?? current.placeId,
      standardizedAddress: pin.standardizedAddress ?? current.standardizedAddress,
      location: pin.standardizedAddress ?? (current.location || formatPinnedLocation(pin.latitude, pin.longitude)),
    }));
  }

  function submit() {
    setError('');
    if (isSubmitting) return;
    const hasLocationOrPin = Boolean(form.location.trim()) || hasConfirmedPin(form);
    if (!form.businessName.trim() || !form.contactName.trim() || !form.phone.trim() || !hasLocationOrPin) {
      setError('Business, contact, phone, and a typed address or confirmed map pin are required.');
      return;
    }
    setIsSubmitting(true);
    const result = actions.createLead(form);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Unable to create lead.');
      setIsSubmitting(false);
      return;
    }
    navigate(`/leads/${result.data.id}`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="New lead" description="Constrained D2D/staff intake. No customer roof photo is collected; Solar Snapshot uses the location/pin." />
      <Panel title="Solar readiness intake">
        {error ? (
          <Alert className="mb-4 border-red-200 bg-red-50 text-red-900">
            <AlertTitle>Cannot create lead</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-6">
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">1. Contact and source</h2>
              <p className="text-xs text-muted-foreground">Capture who the rep is talking to and how the lead entered the system.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business / household name</Label>
                <Input id="businessName" value={form.businessName} onChange={(event) => patch('businessName', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactName">Contact person</Label>
                <Input id="contactName" value={form.contactName} onChange={(event) => patch('contactName', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(event) => patch('phone', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={form.source} onValueChange={(value) => patch('source', value as LeadSource)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['d2d', 'public_inquiry', 'remote_intake', 'referral', 'phone', 'messenger', 'manual'].map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
          <Separator />
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">2. Location and utility</h2>
              <p className="text-xs text-muted-foreground">This will drive Maps enrichment and the shared Solar Snapshot before survey dispatch.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="location">Location / pinned address</Label>
                <Input id="location" value={form.location} onChange={(event) => patch('location', event.target.value)} placeholder="Type an address, or use the map/device pin below" />
                <p className="text-xs text-muted-foreground">A confirmed pin is enough. The typed address is optional when lat/lng is captured.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="utilityProvider">Utility provider</Label>
                <Input id="utilityProvider" value={form.utilityProvider} onChange={(event) => patch('utilityProvider', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Site control</Label>
                <Select value={form.siteControl} onValueChange={(value) => patch('siteControl', value as SiteControl)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['owned', 'leased_with_authorization', 'rented_needs_authorization', 'unknown'].map((control) => <SelectItem key={control} value={control}>{control}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ManualPinMap
              address={form.location}
              utilityProvider={form.utilityProvider}
              value={{
                latitude: form.latitude,
                longitude: form.longitude,
                placeId: form.placeId,
                standardizedAddress: form.standardizedAddress,
              }}
              onChange={patchPin}
            />
          </section>
          <Separator />
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">3. Energy and intent</h2>
              <p className="text-xs text-muted-foreground">Use a fallback bill or monthly kWh when OCR is not ready. If bill is blank, kWh estimates the bill at PHP 11/kWh for readiness.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="monthlyBill">Fallback electric bill (PHP / month)</Label>
                <Input id="monthlyBill" type="number" min="0" value={form.monthlyBill || ''} onChange={(event) => patch('monthlyBill', numberValue(event.target.value))} placeholder="Example: 18000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthlyKwh">Monthly usage fallback (kWh)</Label>
                <Input id="monthlyKwh" type="number" min="0" value={form.monthlyKwh ?? ''} onChange={(event) => patch('monthlyKwh', optionalNumberValue(event.target.value))} placeholder="Example: 1600" />
                <p className="text-xs text-muted-foreground">Use this when the customer knows consumption but the peso amount is unclear.</p>
              </div>
              <div className="space-y-2">
                <Label>Goal</Label>
                <Select value={form.goal} onValueChange={(value) => patch('goal', value as LeadGoal)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['lower_bill', 'brownout_protection', 'both', 'green_property_upgrade', 'business_continuity'].map((goal) => <SelectItem key={goal} value={goal}>{goal}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
        </div>
        <div className="mt-6 flex justify-end">
          <Button disabled={isSubmitting} onClick={submit}>{isSubmitting ? 'Creating...' : 'Create lead'}</Button>
        </div>
      </Panel>
    </div>
  );
}
