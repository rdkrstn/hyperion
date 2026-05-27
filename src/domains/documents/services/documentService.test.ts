import { describe, expect, it } from 'vitest';
import { createDocumentRecord, documentRequirementGate, proposalDocumentGate, replaceDocumentFile, validateDocument } from './documentService';

describe('document service', () => {
  it('keeps one linked document record and clears blockers only after validation', () => {
    const bill = createDocumentRecord({
      leadId: 'lead-1',
      dealId: 'deal-1',
      category: 'customer_bill',
      fileName: 'bill.pdf',
      mimeType: 'application/pdf',
      storagePath: 'lead-1/bill.pdf',
      uploadedBy: 'sales-1',
    });

    expect(bill.validationStatus).toBe('pending_validation');
    expect(documentRequirementGate([bill], ['customer_bill']).allowed).toBe(false);

    const validated = validateDocument(bill, 'cs-1');

    expect(validated.leadId).toBe('lead-1');
    expect(validated.dealId).toBe('deal-1');
    expect(documentRequirementGate([validated], ['customer_bill']).allowed).toBe(true);
  });

  it('returns per-category proposal requirements and accepts validated lead-level documents for a deal', () => {
    const leadOnlyBill = validateDocument(createDocumentRecord({
      leadId: 'lead-1',
      category: 'customer_bill',
      fileName: 'bill.pdf',
      mimeType: 'application/pdf',
      storagePath: 'lead-1/bill.pdf',
      uploadedBy: 'sales-1',
    }), 'cs-1');
    const leadOnlyId = validateDocument(createDocumentRecord({
      leadId: 'lead-1',
      category: 'valid_id',
      fileName: 'id.jpg',
      mimeType: 'image/jpeg',
      storagePath: 'lead-1/id.jpg',
      uploadedBy: 'sales-1',
    }), 'cs-1');

    const gate = proposalDocumentGate({
      documents: [leadOnlyBill, leadOnlyId],
      dealId: 'deal-1',
      leadId: 'lead-1',
    });

    expect(gate.allowed).toBe(false);
    expect(gate.requirements.find((item) => item.category === 'customer_bill')).toMatchObject({
      passed: true,
      matchedDocument: expect.objectContaining({ fileName: 'bill.pdf' }),
    });
    expect(gate.requirements.find((item) => item.category === 'site_control_document')).toMatchObject({
      passed: false,
      blockingReason: 'Site-Control Document must be uploaded and validated.',
    });
    expect(gate.reason).toBe('Validate required documents: Site-Control Document');
  });

  it('replaces a stored file payload and resets validation', () => {
    const validated = validateDocument(createDocumentRecord({
      leadId: 'lead-1',
      category: 'customer_bill',
      fileName: 'old.pdf',
      mimeType: 'application/pdf',
      storagePath: 'lead-1/customer_bill/old.pdf',
      uploadedBy: 'sales-1',
      fileDataUrl: 'data:application/pdf;base64,old',
      fileSizeBytes: 12,
    }), 'cs-1');

    const replaced = replaceDocumentFile(validated, {
      fileName: 'new.pdf',
      mimeType: 'application/pdf',
      storagePath: 'lead-1/customer_bill/new.pdf',
      fileDataUrl: 'data:application/pdf;base64,new',
      fileSizeBytes: 24,
    });

    expect(replaced).toMatchObject({
      fileName: 'new.pdf',
      storagePath: 'lead-1/customer_bill/new.pdf',
      fileSizeBytes: 24,
      validationStatus: 'pending_validation',
      validatedBy: undefined,
    });
  });
});
