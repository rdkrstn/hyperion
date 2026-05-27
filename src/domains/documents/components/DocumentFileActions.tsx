import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Eye, FileDown, RefreshCcw, Trash2 } from 'lucide-react';
import type { SolarOpsActions } from '../../../shared/api/solarOpsStore';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { DocumentRecord } from '../types';
import { downloadDataUrl, readLocalFile } from '../services/localDocumentFiles';

interface DocumentFileActionsProps {
  document: DocumentRecord;
  actions: SolarOpsActions;
  compact?: boolean;
}

function storagePathFor(document: DocumentRecord, fileName: string) {
  const owner = document.leadId ?? document.dealId ?? document.surveyId ?? document.proposalId ?? document.clientId ?? 'document';
  return `${owner}/${document.category}/${fileName}`;
}

export function DocumentFileActions({ document, actions, compact = false }: DocumentFileActionsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function replaceFile(file?: File) {
    if (!file) return;
    const payload = await readLocalFile(file);
    actions.replaceDocumentFile(document.id, {
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      fileSizeBytes: payload.fileSizeBytes,
      fileDataUrl: payload.fileDataUrl,
      storagePath: storagePathFor(document, payload.fileName),
    });
  }

  const hasPayload = Boolean(document.fileDataUrl);

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="xs" variant="outline" asChild>
        <Link to={`/documents/${document.id}`}>
        <Eye className="size-3" />
        View
        </Link>
      </Button>
      <Button size="xs" variant="outline" disabled={!hasPayload} onClick={() => downloadDataUrl(document.fileName, document.fileDataUrl)}>
        <FileDown className="size-3" />
        Download
      </Button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          void replaceFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <Button size="xs" variant="outline" onClick={() => inputRef.current?.click()}>
        <RefreshCcw className="size-3" />
        Replace
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="xs" variant="destructive">
            <Trash2 className="size-3" />
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the file record from the local vault and can reopen document blockers for linked proposals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => actions.deleteDocument(document.id)}>Delete file</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {!hasPayload && !compact ? <p className="basis-full text-xs text-muted-foreground">Open the viewer to request a signed Supabase URL, or replace this metadata record with an actual local file.</p> : null}
    </div>
  );
}
