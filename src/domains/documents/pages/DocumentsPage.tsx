import { useState } from 'react';
import { useSolarOps } from '../../../shared/api/SolarOpsProvider';
import { Badge, EmptyState, PageHeader, Panel, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '../../../shared/ui/primitives';
import { titleize } from '../../../shared/utils/format';
import type { DocumentCategory } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DocumentFileActions } from '../components/DocumentFileActions';
import { readLocalFile } from '../services/localDocumentFiles';
import { buildNetMeteringWorkflowView } from '../../net-metering/services/netMeteringWorkflowService';
import { NetMeteringWorkflowPanel } from '../../net-metering/components/NetMeteringWorkflowPanel';

const categories: DocumentCategory[] = ['customer_bill', 'valid_id', 'site_control_document', 'business_docs', 'generated_compliance_pdf', 'invoice'];

export function DocumentsPage() {
  const { state, actions } = useSolarOps();
  const [recordType, setRecordType] = useState<'lead' | 'deal'>(state.deals.length ? 'deal' : 'lead');
  const [leadId, setLeadId] = useState(state.leads[0]?.id ?? '');
  const [dealId, setDealId] = useState(state.deals[0]?.id ?? '');
  const [category, setCategory] = useState<DocumentCategory>('customer_bill');
  const [fileName, setFileName] = useState('document.pdf');
  const [file, setFile] = useState<File | undefined>();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_validation' | 'validated' | 'rejected'>('all');
  const [rejectingId, setRejectingId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const selectedDeal = state.deals.find((deal) => deal.id === dealId);
  const selectedLead = recordType === 'deal'
    ? state.leads.find((lead) => lead.id === selectedDeal?.leadId)
    : state.leads.find((lead) => lead.id === leadId);
  const documents = statusFilter === 'all' ? state.documents : state.documents.filter((document) => document.validationStatus === statusFilter);
  const canUpload = Boolean(selectedLead);
  const selectedDealSurveys = selectedDeal ? state.surveys.filter((survey) => survey.dealId === selectedDeal.id) : [];
  const selectedDealDocuments = selectedDeal ? state.documents.filter((document) => document.dealId === selectedDeal.id || document.leadId === selectedDeal.leadId) : [];
  const netMeteringView = selectedDeal ? buildNetMeteringWorkflowView({
    deal: selectedDeal,
    documents: selectedDealDocuments,
    surveys: selectedDealSurveys,
    utilityProvider: selectedLead?.siteProfile.utilityProvider,
  }) : undefined;

  async function upload() {
    if (!selectedLead || !file) return;
    const payload = await readLocalFile(file);
    const recordedName = fileName || payload.fileName;
    actions.uploadDocument({
      leadId: selectedLead.id,
      dealId: recordType === 'deal' ? selectedDeal?.id : undefined,
      category,
      fileName: recordedName,
      mimeType: payload.mimeType,
      fileSizeBytes: payload.fileSizeBytes,
      fileDataUrl: payload.fileDataUrl,
      storagePath: `${selectedLead.id}/${category}/${recordedName}`,
      uploadedBy: 'staff',
    });
    setFile(undefined);
    setFileName('document.pdf');
  }

  function rejectDocument() {
    if (!rejectingId) return;
    actions.rejectDocument(rejectingId, 'cs-1', rejectReason);
    setRejectingId('');
    setRejectReason('');
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" description="Document Vault, validation queue, remote intake uploads, compliance docs, and net-metering blockers." />
      <Panel title="Add file to vault">
        <div className="grid gap-4 md:grid-cols-5">
          <div className="space-y-2">
            <Label>Record type</Label>
            <Select value={recordType} onValueChange={(value) => setRecordType(value as 'lead' | 'deal')}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="deal" disabled={!state.deals.length}>Deal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{recordType === 'deal' ? 'Deal' : 'Lead'}</Label>
            {recordType === 'deal' ? (
            <Select value={dealId} onValueChange={setDealId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select deal" /></SelectTrigger>
              <SelectContent>{state.deals.map((deal) => <SelectItem key={deal.id} value={deal.id}>{deal.name}</SelectItem>)}</SelectContent>
            </Select>
            ) : (
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select lead" /></SelectTrigger>
              <SelectContent>{state.leads.map((lead) => <SelectItem key={lead.id} value={lead.id}>{lead.businessName}</SelectItem>)}</SelectContent>
            </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as DocumentCategory)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((item) => <SelectItem key={item} value={item}>{titleize(item)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>File</Label>
            <Input type="file" onChange={(event) => {
              const selected = event.target.files?.[0];
              setFile(selected);
              if (selected) setFileName(selected.name);
            }} />
          </div>
          <div className="space-y-2">
            <Label>Recorded name</Label>
            <Input value={fileName} onChange={(event) => setFileName(event.target.value)} />
          </div>
          <div className="md:col-span-5">
            <Button disabled={!canUpload || !file} onClick={() => void upload()}>Upload file</Button>
          </div>
        </div>
      </Panel>
      <Panel title="Validation queue" action={
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['all', 'pending_validation', 'validated', 'rejected'].map((status) => <SelectItem key={status} value={status}>{titleize(status)}</SelectItem>)}
          </SelectContent>
        </Select>
      }>
        {documents.length ? (
          <TableWrap>
            <Table>
              <TableHeader><TableRow><TableHead>File</TableHead><TableHead>Category</TableHead><TableHead>Linked lead</TableHead><TableHead>Linked deal</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>{document.fileName}<p className="text-xs text-muted-foreground">{document.storagePath}</p></TableCell>
                    <TableCell>{titleize(document.category)}</TableCell>
                    <TableCell>{document.leadId ?? '-'}</TableCell>
                    <TableCell>{document.dealId ?? '-'}</TableCell>
                    <TableCell><Badge tone={document.validationStatus === 'validated' ? 'success' : document.validationStatus === 'rejected' ? 'error' : 'warning'}>{titleize(document.validationStatus)}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <DocumentFileActions document={document} actions={actions} compact />
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="xs" disabled={document.validationStatus === 'validated'}>Validate</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Validate this document?</AlertDialogTitle>
                              <AlertDialogDescription>Validation clears document blockers for linked lead/deal requirements.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => actions.validateDocument(document.id, 'cs-1')}>Validate</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button size="xs" variant="destructive" disabled={document.validationStatus === 'rejected'} onClick={() => setRejectingId(document.id)}>Reject</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        ) : <EmptyState text="No documents uploaded yet. Upload customer bill, valid ID, and site-control documents to clear proposal blockers." />}
      </Panel>
      <Dialog open={Boolean(rejectingId)} onOpenChange={(open) => !open && setRejectingId('')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject document</DialogTitle>
            <DialogDescription>Rejection keeps the blocker active and writes the reason to the timeline.</DialogDescription>
          </DialogHeader>
          <Input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Reason for rejection" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingId('')}>Cancel</Button>
            <Button disabled={!rejectReason.trim()} variant="destructive" onClick={rejectDocument}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {selectedDeal ? <NetMeteringWorkflowPanel view={netMeteringView} /> : null}
    </div>
  );
}
