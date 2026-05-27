import type { DocumentRecord } from '../types';

export type DocumentViewerKind = 'image' | 'pdf' | 'download';
export type DocumentViewerSourceKind = 'local_data_url' | 'supabase_signed_url' | 'missing_payload';

export interface DocumentViewerSource {
  kind: DocumentViewerKind;
  source: DocumentViewerSourceKind;
  url?: string;
  canPreview: boolean;
  message?: string;
}

export function documentViewerKind(mimeType: string): DocumentViewerKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'download';
}

export function buildDocumentViewerSource(document: DocumentRecord, signedUrl?: string): DocumentViewerSource {
  const kind = documentViewerKind(document.mimeType);
  if (document.fileDataUrl) {
    return {
      kind,
      source: 'local_data_url',
      url: document.fileDataUrl,
      canPreview: kind !== 'download',
    };
  }
  if (signedUrl) {
    return {
      kind,
      source: 'supabase_signed_url',
      url: signedUrl,
      canPreview: kind !== 'download',
    };
  }
  return {
    kind,
    source: 'missing_payload',
    url: undefined,
    canPreview: false,
    message: 'Open this document in Supabase mode to request a signed private Storage URL.',
  };
}
