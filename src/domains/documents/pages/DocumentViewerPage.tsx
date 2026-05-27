import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, RefreshCcw, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useSolarOps } from '../../../shared/api/SolarOpsProvider';
import { Badge, EmptyState, Info, PageHeader, Panel } from '../../../shared/ui/primitives';
import { titleize } from '../../../shared/utils/format';
import { businessMutations } from '../../../shared/api/businessMutations';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildDocumentViewerSource } from '../services/documentViewerService';
import { downloadDataUrl, readLocalFile } from '../services/localDocumentFiles';

export function DocumentViewerPage() {
  const { id = '' } = useParams();
  const { state, actions } = useSolarOps();
  const document = state.documents.find((item) => item.id === id);
  const lead = document?.leadId ? state.leads.find((item) => item.id === document.leadId) : undefined;
  const deal = document?.dealId ? state.deals.find((item) => item.id === document.dealId) : undefined;
  const timeline = state.timelineEvents.filter((event) => event.ownerId === id);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [signedUrl, setSignedUrl] = useState<string>();
  const [message, setMessage] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function loadSignedUrl() {
      if (!document || document.fileDataUrl || !isSupabaseConfigured) return;
      const result = await businessMutations.createDocumentSignedUrl({ document_id: document.id, expires_in: 300 });
      if (!cancelled) {
        if (result.ok) setSignedUrl(result.data.signed_url);
        else setMessage(result.error.message);
      }
    }
    void loadSignedUrl();
    return () => { cancelled = true; };
  }, [document?.id, document?.fileDataUrl]);

  const viewer = useMemo(() => document ? buildDocumentViewerSource(document, signedUrl) : undefined, [document, signedUrl]);

  if (!document || !viewer) {
    return <EmptyState text="Document not found." action={<Button asChild variant="outline"><Link to="/documents">Back to documents</Link></Button>} />;
  }
  const currentDocument = document;
  const currentViewer = viewer;

  async function replaceFile(file?: File) {
    if (!file) return;
    const payload = await readLocalFile(file);
    const result = actions.replaceDocumentFile(currentDocument.id, {
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      fileSizeBytes: payload.fileSizeBytes,
      fileDataUrl: payload.fileDataUrl,
      storagePath: `${currentDocument.leadId ?? currentDocument.dealId ?? 'document'}/${currentDocument.category}/${payload.fileName}`,
    });
    setMessage(result.message ?? result.error ?? '');
  }

  function download() {
    if (currentDocument.fileDataUrl) {
      downloadDataUrl(currentDocument.fileName, currentDocument.fileDataUrl);
      return;
    }
    if (currentViewer.url) window.open(currentViewer.url, '_blank', 'noopener,noreferrer');
  }

  function validate() {
    const result = actions.validateDocument(currentDocument.id, 'cs-1');
    setMessage(result.message ?? result.error ?? '');
  }

  async function runBillOcr() {
    if (isSupabaseConfigured && !currentDocument.fileDataUrl) {
      if (!currentDocument.leadId) {
        setMessage('Customer Bill must be linked to a lead before OCR.');
        return;
      }
      const result = await businessMutations.runBillOcrPreaudit({
        lead_id: currentDocument.leadId,
        storagePath: currentDocument.storagePath,
        fileName: currentDocument.fileName,
      });
      setMessage(result.ok ? 'Gemini OCR completed through bill-ocr-preaudit.' : result.error.message);
      return;
    }
    const result = actions.runBillOcrForDocument(currentDocument.id);
    setMessage(result.message ?? result.error ?? '');
  }

  function reject() {
    const result = actions.rejectDocument(currentDocument.id, 'cs-1', rejectReason);
    setMessage(result.message ?? result.error ?? '');
    if (result.ok) {
      setRejectOpen(false);
      setRejectReason('');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={document.fileName}
        description={`${titleize(document.category)} / ${document.bucket}`}
        action={<Button asChild size="sm" variant="outline"><Link to="/documents">Back to documents</Link></Button>}
      />
      {message ? <Alert><AlertDescription>{message}</AlertDescription></Alert> : null}
      <div className="grid gap-4 xl:grid-cols-[1fr_0.45fr]">
        <Panel title="Preview" action={<Badge tone={document.validationStatus === 'validated' ? 'success' : document.validationStatus === 'rejected' ? 'error' : 'warning'}>{titleize(document.validationStatus)}</Badge>}>
          <div className="min-h-[28rem] rounded-lg border bg-muted/20 p-3">
            {viewer.canPreview && viewer.kind === 'image' && viewer.url ? (
              <div className="space-y-3">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}><ZoomOut className="size-4" /> Zoom out</Button>
                  <Button size="sm" variant="outline" onClick={() => setZoom((value) => Math.min(3, value + 0.25))}><ZoomIn className="size-4" /> Zoom in</Button>
                </div>
                <div className="max-h-[70vh] overflow-auto rounded-lg bg-background p-3">
                  <img src={viewer.url} alt={document.fileName} className="mx-auto origin-top rounded-lg object-contain transition-transform" style={{ transform: `scale(${zoom})` }} />
                </div>
              </div>
            ) : viewer.canPreview && viewer.kind === 'pdf' && viewer.url ? (
              <iframe className="h-[70vh] w-full rounded-lg border bg-background" src={viewer.url} title={document.fileName} />
            ) : (
              <div className="flex h-80 items-center justify-center text-center">
                <div className="max-w-md space-y-3">
                  <p className="font-semibold">{viewer.kind === 'download' ? 'Preview is not available for this file type.' : 'File preview is unavailable.'}</p>
                  <p className="text-sm text-muted-foreground">{viewer.message ?? 'Use download to open the private file.'}</p>
                  <Button disabled={!document.fileDataUrl && !viewer.url} onClick={download}>Download file</Button>
                </div>
              </div>
            )}
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title="File metadata">
            <div className="grid gap-3">
              <Info label="Category" value={titleize(document.category)} />
              <Info label="MIME type" value={document.mimeType} />
              <Info label="Storage path" value={document.storagePath} />
              <Info label="Size" value={document.fileSizeBytes ? `${Math.round(document.fileSizeBytes / 1024).toLocaleString()} KB` : 'Unknown'} />
              <Info label="Linked lead" value={lead ? <Link className="underline underline-offset-4" to={`/leads/${lead.id}`}>{lead.businessName}</Link> : '-'} />
              <Info label="Linked deal" value={deal ? <Link className="underline underline-offset-4" to={`/deals/${deal.id}`}>{deal.name}</Link> : '-'} />
            </div>
          </Panel>
          <Panel title="Actions">
            <input ref={inputRef} type="file" className="hidden" onChange={(event) => {
              void replaceFile(event.target.files?.[0]);
              event.target.value = '';
            }} />
            <div className="grid gap-2">
              <Button variant="outline" disabled={!document.fileDataUrl && !viewer.url} onClick={download}><Download className="size-4" /> Download</Button>
              <Button variant="outline" onClick={() => inputRef.current?.click()}><RefreshCcw className="size-4" /> Replace file</Button>
              {document.category === 'customer_bill' ? <Button variant="outline" onClick={() => void runBillOcr()}>Run Gemini OCR</Button> : null}
              <Button disabled={document.validationStatus === 'validated'} onClick={validate}>Validate</Button>
              <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <Button variant="destructive" disabled={document.validationStatus === 'rejected'} onClick={() => setRejectOpen(true)}>Reject</Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reject document</DialogTitle>
                    <DialogDescription>Rejection keeps the document blocker active.</DialogDescription>
                  </DialogHeader>
                  <Input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Reason for rejection" />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
                    <Button variant="destructive" disabled={!rejectReason.trim()} onClick={reject}>Reject</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="size-4" /> Delete record</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                    <AlertDialogDescription>This removes the local vault record and can reopen proposal blockers.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => actions.deleteDocument(document.id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Panel>
          <Panel title="Timeline">
            {timeline.length ? timeline.map((event) => (
              <div key={event.id} className="border-b py-2">
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-muted-foreground">{event.description}</p>
              </div>
            )) : <EmptyState text="No document timeline yet." />}
          </Panel>
        </div>
      </div>
    </div>
  );
}
