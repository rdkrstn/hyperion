import type { DealFile, DealFileCategory, DealFileValidationStatus, FileRequirement, Role } from '../types';

function stamp() {
  return new Date().toLocaleString('en-PH');
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export const requiredNetMeteringFileCategories: DealFileCategory[] = [
  'customer_bill',
  'valid_id',
  'site_control_document',
];

export const dealFileCategoryLabels: Record<DealFileCategory, string> = {
  customer_bill: 'Customer bill',
  valid_id: 'Valid ID',
  site_control_document: 'Site-control document',
  business_docs: 'Business documents',
  survey_evidence: 'Survey evidence',
  compliance_template: 'Compliance template',
  generated_compliance_pdf: 'Generated compliance PDF',
  proposal_snapshot: 'Proposal snapshot',
  contract: 'Contract',
  invoice: 'Invoice',
  receipt_reference: 'Receipt / reference',
};

export function buildDealFile(input: {
  dealId: string;
  category: DealFileCategory;
  fileName: string;
  mimeType: string;
  uploadedByRole: Role | 'remote-client' | 'system';
  storagePath?: string;
  source?: DealFile['source'];
  linkedRecordType?: DealFile['linkedRecordType'];
  linkedRecordId?: string;
  bucket?: string;
  previewUrl?: string;
}): DealFile {
  const now = stamp();
  const safeFileName = input.fileName.replace(/[^\w.\- ]+/g, '-');
  return {
    id: id('file'),
    dealId: input.dealId,
    category: input.category,
    source: input.source ?? (input.uploadedByRole === 'remote-client' ? 'remote_intake' : input.uploadedByRole === 'system' ? 'system_generated' : 'staff_upload'),
    linkedRecordType: input.linkedRecordType ?? 'lead',
    linkedRecordId: input.linkedRecordId ?? input.dealId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    storagePath: input.storagePath ?? `${input.dealId}/deal-files/${input.category}/${id('object')}-${safeFileName}`,
    bucket: input.bucket ?? 'deal-files',
    uploadedByRole: input.uploadedByRole,
    uploadedAt: now,
    validationStatus: 'pending_validation',
    previewUrl: input.previewUrl,
    auditTrail: [{ actor: input.uploadedByRole, action: 'uploaded', note: `${dealFileCategoryLabels[input.category]} uploaded.`, createdAt: now }],
  };
}

function canValidate(actorRole: Role) {
  return actorRole === 'cs' || actorRole === 'owner';
}

export function validateDealFile(file: DealFile, actorRole: Role): DealFile {
  if (!canValidate(actorRole)) throw new Error('Only CS or owner can validate uploaded documents.');
  const now = stamp();
  return {
    ...file,
    validationStatus: 'validated',
    validatedByRole: actorRole,
    validatedAt: now,
    rejectionReason: undefined,
    auditTrail: [
      { actor: actorRole, action: 'validated', note: `${dealFileCategoryLabels[file.category]} validated.`, createdAt: now },
      ...file.auditTrail,
    ],
  };
}

export function rejectDealFile(file: DealFile, actorRole: Role, reason: string): DealFile {
  if (!canValidate(actorRole)) throw new Error('Only CS or owner can reject uploaded documents.');
  if (!reason.trim()) throw new Error('Rejection reason is required.');
  const now = stamp();
  return {
    ...file,
    validationStatus: 'rejected',
    validatedByRole: actorRole,
    validatedAt: now,
    rejectionReason: reason.trim(),
    auditTrail: [
      { actor: actorRole, action: 'rejected', note: reason.trim(), createdAt: now },
      ...file.auditTrail,
    ],
  };
}

export function fileRequirementStatus(files: DealFile[] = [], category: DealFileCategory): FileRequirement {
  const file = files.find((item) => item.category === category && item.validationStatus !== 'rejected');
  const validated = file?.validationStatus === 'validated';
  return {
    category,
    label: dealFileCategoryLabels[category],
    required: true,
    satisfied: validated,
    status: file?.validationStatus ?? 'missing',
  };
}

export function requiredFileRequirements(files: DealFile[] = []) {
  return requiredNetMeteringFileCategories.map((category) => fileRequirementStatus(files, category));
}

export function createSignedDownloadUrl(file: DealFile, baseUrl = '/storage/sign') {
  return `${baseUrl}?bucket=${encodeURIComponent(file.bucket)}&path=${encodeURIComponent(file.storagePath)}&file=${encodeURIComponent(file.fileName)}`;
}

export function hasValidatedRequiredFiles(files: DealFile[] = []) {
  const requirements = requiredFileRequirements(files);
  return {
    allowed: requirements.every((requirement) => requirement.satisfied),
    requirements,
    missing: requirements.filter((requirement) => !requirement.satisfied).map((requirement) => requirement.label),
  };
}

export function validationStatusClass(status: DealFileValidationStatus | 'missing') {
  if (status === 'validated') return 'badge-success';
  if (status === 'rejected') return 'badge-error';
  if (status === 'pending_validation') return 'badge-warning';
  return 'badge-outline';
}
