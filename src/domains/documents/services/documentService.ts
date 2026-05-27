import { makeId, nowIso } from '../../../shared/types/app';
import type { DocumentCategory, DocumentRecord } from '../types';

export const proposalRequiredDocumentCategories: DocumentCategory[] = ['customer_bill', 'valid_id', 'site_control_document'];

export function documentCategoryLabel(category: DocumentCategory) {
  const labels: Record<DocumentCategory, string> = {
    customer_bill: 'Customer Bill',
    valid_id: 'Valid ID',
    site_control_document: 'Site-Control Document',
    business_docs: 'Business Docs',
    survey_evidence: 'Survey Evidence',
    compliance_template: 'Compliance Template',
    generated_compliance_pdf: 'Generated Compliance PDF',
    proposal_snapshot: 'Proposal Snapshot',
    contract: 'Contract',
    invoice: 'Invoice',
    receipt_reference: 'Receipt / Reference',
  };
  return labels[category];
}

export function createDocumentRecord(input: Omit<DocumentRecord, 'id' | 'bucket' | 'validationStatus' | 'createdAt' | 'updatedAt'> & { bucket?: DocumentRecord['bucket'] }): DocumentRecord {
  const createdAt = nowIso();
  return {
    id: makeId('doc'),
    bucket: input.bucket ?? 'deal-files',
    validationStatus: 'pending_validation',
    createdAt,
    updatedAt: createdAt,
    ...input,
  };
}

export function validateDocument(document: DocumentRecord, validatedBy: string): DocumentRecord {
  return {
    ...document,
    validationStatus: 'validated',
    validatedBy,
    rejectionReason: undefined,
    updatedAt: nowIso(),
  };
}

export function rejectDocument(document: DocumentRecord, validatedBy: string, reason: string): DocumentRecord {
  return {
    ...document,
    validationStatus: 'rejected',
    validatedBy,
    rejectionReason: reason,
    updatedAt: nowIso(),
  };
}

export function replaceDocumentFile(document: DocumentRecord, input: {
  fileName: string;
  mimeType: string;
  storagePath: string;
  fileSizeBytes?: number;
  fileDataUrl?: string;
}): DocumentRecord {
  return {
    ...document,
    fileName: input.fileName,
    mimeType: input.mimeType,
    storagePath: input.storagePath,
    fileSizeBytes: input.fileSizeBytes,
    fileDataUrl: input.fileDataUrl,
    validationStatus: 'pending_validation',
    validatedBy: undefined,
    rejectionReason: undefined,
    updatedAt: nowIso(),
  };
}

export function documentRequirementGate(documents: DocumentRecord[], requiredCategories: DocumentCategory[]) {
  const validated = new Set(documents.filter((document) => document.validationStatus === 'validated').map((document) => document.category));
  const missing = requiredCategories.filter((category) => !validated.has(category));
  return {
    allowed: missing.length === 0,
    missing,
    reason: missing.length ? `Validate required documents: ${missing.map(documentCategoryLabel).join(', ')}` : 'Required documents are validated.',
  };
}

export interface ProposalDocumentRequirement {
  category: DocumentCategory;
  label: string;
  passed: boolean;
  matchedDocument?: DocumentRecord;
  status: 'missing' | 'pending_validation' | 'validated' | 'rejected';
  blockingReason?: string;
}

export function proposalDocumentGate(input: {
  documents: DocumentRecord[];
  dealId: string;
  leadId: string;
  requiredCategories?: DocumentCategory[];
}) {
  const requiredCategories = input.requiredCategories ?? proposalRequiredDocumentCategories;
  const linkedDocuments = input.documents.filter((document) => (
    document.dealId === input.dealId || document.leadId === input.leadId
  ));
  const requirements: ProposalDocumentRequirement[] = requiredCategories.map((category) => {
    const categoryDocuments = linkedDocuments.filter((document) => document.category === category);
    const matchedDocument = categoryDocuments.find((document) => document.validationStatus === 'validated')
      ?? categoryDocuments.find((document) => document.validationStatus === 'pending_validation')
      ?? categoryDocuments.find((document) => document.validationStatus === 'rejected');
    const status = matchedDocument?.validationStatus ?? 'missing';
    const label = documentCategoryLabel(category);
    const passed = status === 'validated';
    return {
      category,
      label,
      passed,
      matchedDocument,
      status,
      blockingReason: passed ? undefined : `${label} must be uploaded and validated.`,
    };
  });
  const missing = requirements.filter((requirement) => !requirement.passed);
  return {
    allowed: missing.length === 0,
    missing: missing.map((requirement) => requirement.category),
    requirements,
    reason: missing.length ? `Validate required documents: ${missing.map((requirement) => requirement.label).join(', ')}` : 'Required documents are validated.',
  };
}
