import { describe, expect, it } from 'vitest';
import { buildDocumentViewerSource, documentViewerKind } from './documentViewerService';
import type { DocumentRecord } from '../types';

const baseDocument: DocumentRecord = {
  id: 'doc-1',
  leadId: 'lead-1',
  category: 'customer_bill',
  fileName: 'bill.jpg',
  mimeType: 'image/jpeg',
  fileDataUrl: 'data:image/jpeg;base64,abc',
  bucket: 'deal-files',
  storagePath: 'lead-1/customer_bill/bill.jpg',
  validationStatus: 'pending_validation',
  uploadedBy: 'sales-1',
  createdAt: '2026-05-22T00:00:00.000Z',
  updatedAt: '2026-05-22T00:00:00.000Z',
};

describe('document viewer service', () => {
  it('uses local data URLs when present', () => {
    const source = buildDocumentViewerSource(baseDocument);

    expect(source).toMatchObject({
      kind: 'image',
      url: baseDocument.fileDataUrl,
      source: 'local_data_url',
      canPreview: true,
    });
  });

  it('uses short-lived Supabase signed URLs when no local payload exists', () => {
    const source = buildDocumentViewerSource({ ...baseDocument, fileDataUrl: undefined }, 'https://signed.example/bill.jpg');

    expect(source).toMatchObject({
      kind: 'image',
      url: 'https://signed.example/bill.jpg',
      source: 'supabase_signed_url',
      canPreview: true,
    });
  });

  it('falls back to metadata when neither local payload nor signed URL is available', () => {
    const source = buildDocumentViewerSource({ ...baseDocument, fileDataUrl: undefined });

    expect(source).toMatchObject({
      kind: 'image',
      url: undefined,
      source: 'missing_payload',
      canPreview: false,
      message: 'Open this document in Supabase mode to request a signed private Storage URL.',
    });
  });

  it('classifies PDFs and unsupported files for the viewer', () => {
    expect(documentViewerKind('application/pdf')).toBe('pdf');
    expect(documentViewerKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('download');
  });
});
