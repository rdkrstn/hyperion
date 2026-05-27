import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSolarOps } from '../../../shared/api/SolarOpsProvider';
import { Badge, EmptyState, Info, PageHeader, Panel } from '../../../shared/ui/primitives';
import type { TimelineEvent } from '../../../shared/types/app';
import { php, titleize } from '../../../shared/utils/format';
import { buildLeadDetailModel } from '../services/leadDetailViewService';
import type { CustomerType, LeadGoal, SiteControl } from '../types';
import type { DocumentCategory } from '../../documents/types';
import { documentCategoryLabel } from '../../documents/services/documentService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ManualPinMap, type PinValue } from '../../solar-snapshot/components/ManualPinMap';
import { SolarWorkbench } from '../../solar-snapshot/components/SolarWorkbench';
import { BillHistoryChart } from '../components/BillHistoryChart';
import { DocumentFileActions } from '../../documents/components/DocumentFileActions';
import { readLocalFile } from '../../documents/services/localDocumentFiles';
import { businessMutations } from '../../../shared/api/businessMutations';
import { isSupabaseConfigured } from '../../../lib/supabase';

const tabs = ['Overview', 'Qualification', 'Energy Profile', 'Solar Snapshot', 'Documents', 'Notes', 'Timeline'];
const documentCategories: DocumentCategory[] = ['customer_bill', 'valid_id', 'site_control_document', 'business_docs'];

function compactTimelineEvents(events: TimelineEvent[]) {
  const seenPanelLayout = new Set<string>();
  return events.filter((event) => {
    if (event.title !== 'Solar panel layout updated') return true;
    const key = `${event.ownerType}:${event.ownerId}`;
    if (seenPanelLayout.has(key)) return false;
    seenPanelLayout.add(key);
    return true;
  });
}

export function LeadDetailPage() {
  const { id = '' } = useParams();
  const { state, actions } = useSolarOps();
  const lead = state.leads.find((item) => item.id === id);
  const [tab, setTab] = useState(tabs[0]);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [dealName, setDealName] = useState('');
  const [documentCategory, setDocumentCategory] = useState<DocumentCategory>('customer_bill');
  const [documentFileName, setDocumentFileName] = useState('document.pdf');
  const [documentFile, setDocumentFile] = useState<File | undefined>();
  const [actionMessage, setActionMessage] = useState('');
  const [solarPin, setSolarPin] = useState<PinValue>({
    latitude: lead?.siteProfile.latitude,
    longitude: lead?.siteProfile.longitude,
    placeId: lead?.siteProfile.placeId,
    standardizedAddress: lead?.siteProfile.standardizedAddress,
  });
  const navigate = useNavigate();

  if (!lead) return <EmptyState text="Lead not found." action={<Button asChild variant="outline"><Link to="/leads">Back to leads</Link></Button>} />;
  const currentLead = lead;
  const detailModel = buildLeadDetailModel(currentLead);
  const displayedLead = detailModel.lead;

  const leadDeals = state.deals.filter((deal) => deal.leadId === currentLead.id);
  const solar = state.solarSnapshots.find((snapshot) => snapshot.leadId === currentLead.id);
  const documents = state.documents.filter((document) => document.leadId === currentLead.id);
  const customerBillDocuments = documents.filter((document) => document.category === 'customer_bill');
  const timeline = state.timelineEvents.filter((event) => event.ownerId === currentLead.id || leadDeals.some((deal) => deal.id === event.ownerId));
  const visibleTimeline = compactTimelineEvents(timeline);
  const createGate = detailModel.createGate;
  const billHistory = currentLead.energyProfile.billHistory ?? currentLead.billUploads.find((bill) => bill.monthlySeries?.length)?.monthlySeries;

  function createDeal() {
    const result = actions.createDealFromLead(currentLead.id, {
      name: dealName || `${currentLead.businessName} solar project`,
      salesOwner: currentLead.assignedSales || 'sales-1',
    });
    if (result.ok && result.data) navigate(`/deals/${result.data.id}`);
  }

  function submitOverride() {
    actions.qualifyLead(currentLead.id, overrideReason);
    setOverrideReason('');
    setOverrideOpen(false);
  }

  function runSnapshotFromPin() {
    actions.runSolarSnapshot(currentLead.id, leadDeals[0]?.id, {
      latitude: solarPin.latitude ?? currentLead.siteProfile.latitude ?? 14.5547,
      longitude: solarPin.longitude ?? currentLead.siteProfile.longitude ?? 121.0244,
    });
  }

  function generateEnergyGraph() {
    const result = actions.generateEnergyGraph(currentLead.id);
    setActionMessage(result.message ?? result.error ?? '');
  }

  async function runBillOcr(documentId: string) {
    const document = documents.find((item) => item.id === documentId);
    if (document && isSupabaseConfigured && !document.fileDataUrl) {
      const result = await businessMutations.runBillOcrPreaudit({
        lead_id: currentLead.id,
        storagePath: document.storagePath,
        fileName: document.fileName,
      });
      setActionMessage(result.ok ? 'Gemini OCR completed through bill-ocr-preaudit.' : result.error.message);
      return;
    }
    const result = actions.runBillOcrForDocument(documentId);
    setActionMessage(result.message ?? result.error ?? '');
  }

  async function uploadLeadDocument() {
    if (!documentFile) return;
    const payload = await readLocalFile(documentFile);
    actions.uploadDocument({
      leadId: currentLead.id,
      category: documentCategory,
      fileName: documentFileName || payload.fileName,
      mimeType: payload.mimeType,
      fileSizeBytes: payload.fileSizeBytes,
      fileDataUrl: payload.fileDataUrl,
      storagePath: `${currentLead.id}/${documentCategory}/${documentFileName || payload.fileName}`,
      uploadedBy: 'sales-1',
    });
    setDocumentFile(undefined);
    setDocumentFileName('document.pdf');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.businessName}
        description={`${lead.contactName} / ${lead.siteProfile.location}`}
        action={<Button asChild size="sm" variant="outline"><Link to="/leads">Back to leads</Link></Button>}
      />
      {actionMessage ? <Alert><AlertDescription>{actionMessage}</AlertDescription></Alert> : null}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="max-w-full flex-wrap justify-start">
          {tabs.map((item) => <TabsTrigger key={item} value={item}>{item}</TabsTrigger>)}
        </TabsList>

      <TabsContent value="Overview" className="mt-4">
        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <Panel title="Lead profile">
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Source" value={titleize(lead.source)} />
              <Info label="Monthly bill" value={php.format(lead.energyProfile.monthlyBill)} />
              <Info label="Goal" value={titleize(lead.goal)} />
              <Info label="Site control" value={titleize(lead.siteProfile.siteControl)} />
              <Info label="Readiness" value={<Badge tone={detailModel.readinessTone}>{detailModel.readinessLabel}</Badge>} />
              <Info label="Next action" value={detailModel.nextAction} />
            </div>
          </Panel>
          <Panel title="Stage actions">
            <div className="space-y-3">
              <Button className="w-full" disabled={lead.status === 'qualified'} onClick={() => actions.qualifyLead(lead.id)}>Mark qualified</Button>
              {!createGate.allowed && !lead.qualificationOverride ? (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                  <AlertTitle>Create Deal is blocked</AlertTitle>
                  <AlertDescription className="mt-2 flex flex-wrap gap-2">
                    {createGate.missing.map((item) => <Badge key={item} tone="warning">{item}</Badge>)}
                  </AlertDescription>
                </Alert>
              ) : null}
            {displayedLead.qualificationOverride ? <Badge tone="warning">Qualification override logged</Badge> : null}
              <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full" variant="outline">Override Qualification Constraints</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Override qualification constraints</DialogTitle>
                    <DialogDescription>This bypass is logged in the audit trail and should explain why the lead can move forward.</DialogDescription>
                  </DialogHeader>
                  <Textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Reason for override" />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOverrideOpen(false)}>Cancel</Button>
                    <Button disabled={!overrideReason.trim()} onClick={submitOverride}>Log override</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Input value={dealName} onChange={(event) => setDealName(event.target.value)} placeholder={`${lead.businessName} solar project`} />
              <Button className="w-full" disabled={!createGate.allowed && !lead.qualificationOverride} onClick={createDeal}>Create Deal</Button>
              <Button className="w-full" variant="outline" onClick={runSnapshotFromPin}>Run Solar Snapshot</Button>
            </div>
          </Panel>
        </div>
      </TabsContent>

      <TabsContent value="Qualification" className="mt-4">
        <Panel title="Qualification">
          <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-3">
              {displayedLead.qualificationSections.map((section) => (
                <div key={section.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{section.label}</p>
                    <Badge tone={section.state === 'complete' ? 'success' : section.state === 'required' ? 'error' : 'warning'}>{titleize(section.state)}</Badge>
                  </div>
                  {section.missingItems.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">{section.missingItems.map((item) => <Badge key={item} tone="error">{item} required</Badge>)}</div>
                  ) : <p className="mt-2 text-sm text-muted-foreground">Complete</p>}
                </div>
              ))}
            </div>
            <div className="rounded-lg border p-4">
              <div>
                <p className="font-semibold">Qualification answers</p>
                <p className="text-sm text-muted-foreground">Use this to clear business-fit and site-control blockers before creating a deal.</p>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Business fit</Label>
                  <Select value={lead.customerType} onValueChange={(value) => actions.updateLeadQualification(lead.id, { customerType: value as CustomerType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['residential', 'commercial', 'construction', 'real_estate', 'property_group'].map((value) => <SelectItem key={value} value={value}>{titleize(value)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Site control</Label>
                  <Select value={lead.siteProfile.siteControl} onValueChange={(value) => actions.updateLeadQualification(lead.id, { siteControl: value as SiteControl })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['owned', 'leased_with_authorization', 'rented_needs_authorization', 'unknown'].map((value) => <SelectItem key={value} value={value}>{titleize(value)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Utility provider</Label>
                  <Input value={lead.siteProfile.utilityProvider ?? ''} onChange={(event) => actions.updateLeadQualification(lead.id, { utilityProvider: event.target.value })} placeholder="Meralco, MORE Power, VECO..." />
                </div>
                <div className="space-y-2">
                  <Label>Goal</Label>
                  <Select value={lead.goal} onValueChange={(value) => actions.updateLeadQualification(lead.id, { goal: value as LeadGoal })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['lower_bill', 'brownout_protection', 'both', 'green_property_upgrade', 'business_continuity'].map((value) => <SelectItem key={value} value={value}>{titleize(value)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Daytime usage</Label>
                  <Select value={lead.energyProfile.daytimeUsage} onValueChange={(value) => actions.updateLeadQualification(lead.id, { daytimeUsage: value as typeof lead.energyProfile.daytimeUsage })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['low', 'medium', 'high', 'unknown'].map((value) => <SelectItem key={value} value={value}>{titleize(value)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="qualificationMonthlyBill">Monthly bill estimate</Label>
                  <Input id="qualificationMonthlyBill" type="number" value={lead.energyProfile.monthlyBill} onChange={(event) => actions.updateLeadQualification(lead.id, { monthlyBill: Number(event.target.value) })} />
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </TabsContent>

      <TabsContent value="Energy Profile" className="mt-4">
        <Panel title="Energy profile">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">Energy graph</p>
                <p className="text-sm text-muted-foreground">Bill extraction and annualized usage now live here, not in a separate OCR workspace.</p>
              </div>
              <Button size="sm" variant={billHistory?.length ? 'outline' : 'default'} onClick={generateEnergyGraph}>
                {billHistory?.length ? 'Refresh local/manual graph' : 'Generate local/manual graph'}
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Info label="Monthly bill" value={php.format(lead.energyProfile.monthlyBill)} />
              <Info label="Estimated savings" value={detailModel.estimatedSavingsRange} />
              <Info label="Daytime usage" value={lead.energyProfile.daytimeUsage} />
              <Info label="Battery interest" value={lead.energyProfile.batteryInterest ? 'Yes' : 'No'} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {customerBillDocuments.length ? customerBillDocuments.map((document) => (
                <div key={document.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{document.fileName}</p>
                      <p className="text-xs text-muted-foreground">{documentCategoryLabel(document.category)} / {document.validationStatus}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline"><Link to={`/documents/${document.id}`}>Open file</Link></Button>
                      <Button size="sm" onClick={() => void runBillOcr(document.id)}>Run Gemini OCR</Button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Upload a Customer Bill in Documents, then run Gemini OCR here. Local mode can only parse the bundled Meralco fixtures.
                </div>
              )}
            </div>
            {lead.billUploads.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {lead.billUploads.slice(0, 2).map((bill) => (
                  <div key={bill.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Info label="Extraction" value={bill.extractedMonthlyKwh ? `${bill.extractedMonthlyKwh.toLocaleString()} kWh avg.` : 'Pending extraction'} />
                      <Badge tone={bill.status === 'manual_review' ? 'warning' : 'success'}>{bill.ocrProvider === 'manual' ? 'Local/manual' : bill.ocrProvider ?? 'energy graph'}</Badge>
                    </div>
                    {bill.status === 'manual_review' ? <p className="mt-2 text-sm text-amber-700">Manual review is required before readiness can advance.</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {billHistory?.length ? <BillHistoryChart months={billHistory} /> : (
              <EmptyState text="No energy graph yet. Generate one from the bill estimate, or upload a customer bill for server-side Gemini OCR." />
            )}
          </div>
        </Panel>
      </TabsContent>
      <TabsContent value="Solar Snapshot" className="mt-4">
        <div className="space-y-4">
          <Panel title="Solar Snapshot pin">
            <ManualPinMap
              address={currentLead.siteProfile.standardizedAddress ?? currentLead.siteProfile.location}
              utilityProvider={currentLead.siteProfile.utilityProvider}
              value={solarPin}
              onChange={setSolarPin}
            />
            <Button className="mt-4" disabled={!solarPin.latitude || !solarPin.longitude} onClick={runSnapshotFromPin}>Run Solar Snapshot from pin</Button>
          </Panel>
          <Panel title="Solar Snapshot output">{solar ? <div className="grid gap-3 md:grid-cols-5"><Info label="Status" value={solar.status} /><Info label="Roof cap" value={`${solar.roofCapacityKwp} kWp`} /><Info label="Selected panels" value={`${solar.selectedPanelCount}/${solar.maxPanels}`} /><Info label="Annual production" value={`${solar.annualProductionKwh.toLocaleString()} kWh`} /><Info label="Estimated savings" value={detailModel.estimatedSavingsRange} /></div> : <EmptyState text="Solar Snapshot has not been run yet." />}</Panel>
          {solar ? (
            <Panel title="Solar Workbench">
              <SolarWorkbench snapshot={solar} onApply={(input) => actions.updateSolarPanelLayout(solar.id, input)} />
            </Panel>
          ) : null}
        </div>
      </TabsContent>
      <TabsContent value="Documents" className="mt-4">
        <Panel title="Documents">
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <p className="font-semibold">Upload lead document</p>
              <p className="text-sm text-muted-foreground">Lead-level documents are valid for proposal gates after CS/owner validation, even before a deal exists.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                <Select value={documentCategory} onValueChange={(value) => setDocumentCategory(value as DocumentCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{documentCategories.map((category) => <SelectItem key={category} value={category}>{titleize(category)}</SelectItem>)}</SelectContent>
                </Select>
                <Input
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setDocumentFile(file);
                    if (file) setDocumentFileName(file.name);
                  }}
                />
                <Input value={documentFileName} onChange={(event) => setDocumentFileName(event.target.value)} placeholder="document.pdf" />
                <Button disabled={!documentFile || !documentFileName.trim()} onClick={() => void uploadLeadDocument()}>Upload file</Button>
              </div>
            </div>
            {documents.length ? documents.map((document) => (
              <div key={document.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Info label={document.category} value={`${document.fileName} / ${document.validationStatus}`} />
                  <DocumentFileActions document={document} actions={actions} compact />
                </div>
              </div>
            )) : <EmptyState text="No lead documents uploaded." />}
          </div>
        </Panel>
      </TabsContent>
      <TabsContent value="Notes" className="mt-4"><Panel title="Notes"><p className="text-sm text-muted-foreground">Internal notes can be added after the clean data model is connected to Supabase persistence.</p></Panel></TabsContent>
      <TabsContent value="Timeline" className="mt-4"><Panel title="Timeline">{visibleTimeline.length ? visibleTimeline.map((event) => <div key={event.id} className="border-b py-2"><p className="font-medium">{event.title}</p><p className="text-sm text-muted-foreground">{event.description}</p></div>) : <EmptyState text="No timeline events yet." />}</Panel></TabsContent>
      </Tabs>
    </div>
  );
}
