export type DocumentCategory =
  | 'customer_bill'
  | 'valid_id'
  | 'site_control_document'
  | 'business_docs'
  | 'survey_evidence'
  | 'compliance_template'
  | 'generated_compliance_pdf'
  | 'proposal_snapshot'
  | 'contract'
  | 'invoice'
  | 'receipt_reference';

export interface DocumentRecord {
  id: string;
  leadId?: string;
  dealId?: string;
  surveyId?: string;
  proposalId?: string;
  clientId?: string;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  fileSizeBytes?: number;
  fileDataUrl?: string;
  bucket: 'deal-files' | 'readiness-uploads' | 'survey-evidence' | 'compliance-documents';
  storagePath: string;
  validationStatus: 'pending_validation' | 'validated' | 'rejected';
  uploadedBy: string;
  validatedBy?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}
