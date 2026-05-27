import { callEdgeFunction, type EdgeResult } from './edgeFunctionClient';

export type LeadIntakePayload = {
  businessName: string;
  contactName: string;
  phone?: string;
  email?: string;
  location: string;
  monthlyBillEstimate: number;
  monthlyKwh?: number;
  goal: string;
  businessPropertyType: string;
  source: string;
  paymentPreference: string;
};

export type BillOcrPayload = {
  lead_id: string;
  storagePath: string;
  fileName: string;
};

export type MapsEnrichmentPayload = {
  lead_id: string;
  address?: string;
  place_id?: string;
  lat?: number;
  lng?: number;
};

export type SolarSnapshotPayload = {
  lead_id: string;
  deal_id?: string;
  lat: number;
  lng: number;
};

export type RemoteIntakeCreatePayload = {
  lead_id: string;
  deal_id?: string;
  requested_documents?: string[];
  origin?: string;
};

export type RemoteIntakeUploadPayload = {
  token: string;
  access_jwt: string;
  category: string;
  fileName: string;
  mimeType: string;
  base64: string;
};

export type DocumentValidatePayload = {
  file_id: string;
  action: 'validate' | 'reject';
  reviewer_id: string;
  notes?: string;
};

export type DocumentSignedUrlPayload = {
  document_id: string;
  expires_in?: number;
};

export type SurveyDispatchPayload = {
  deal_id: string;
  installer_id: string;
  schedule: string;
  location: string;
};

export type SurveyEvidenceUploadPayload = {
  survey_id: string;
  category: string;
  fileName: string;
  mimeType: string;
  base64: string;
  is_structurally_sound?: boolean;
};

export type GenerateProposalPayload = {
  deal_id: string;
  system_size_kwp: number;
  payment_option: string;
  pricing_inputs: {
    lines: Array<{
      category: string;
      name: string;
      quantity: number;
      unit?: string;
      unitPrice: number;
      estimatedCost: number;
      sourceReason: string;
      notes?: string;
      optional?: boolean;
      manuallyEdited?: boolean;
    }>;
  };
};

export const businessMutationFunctions = {
  submitLeadIntake: 'lead-intake',
  runBillOcrPreaudit: 'bill-ocr-preaudit',
  runMapsEnrichment: 'maps-enrichment',
  runSolarSnapshot: 'solar-snapshot',
  recalculateReadiness: 'readiness-score',
  createRemoteIntake: 'remote-intake-create',
  uploadRemoteIntake: 'remote-intake-upload',
  createDocumentSignedUrl: 'document-signed-url',
  validateDocument: 'document-validate',
  dispatchSurvey: 'survey-dispatch',
  uploadSurveyEvidence: 'survey-evidence-upload',
  generateProposal: 'generate-proposal',
  generateComplianceDocs: 'generate-compliance-docs',
  acceptContract: 'contract-access',
} as const;

export const businessMutations = {
  submitLeadIntake: (payload: LeadIntakePayload): Promise<EdgeResult<{ lead_id: string }>> =>
    callEdgeFunction(businessMutationFunctions.submitLeadIntake, payload),

  runBillOcrPreaudit: (payload: BillOcrPayload): Promise<EdgeResult<unknown>> =>
    callEdgeFunction(businessMutationFunctions.runBillOcrPreaudit, payload),

  runMapsEnrichment: (payload: MapsEnrichmentPayload): Promise<EdgeResult<unknown>> =>
    callEdgeFunction(businessMutationFunctions.runMapsEnrichment, payload),

  runSolarSnapshot: (payload: SolarSnapshotPayload): Promise<EdgeResult<unknown>> =>
    callEdgeFunction(businessMutationFunctions.runSolarSnapshot, payload),

  recalculateReadiness: (leadId: string): Promise<EdgeResult<unknown>> =>
    callEdgeFunction(businessMutationFunctions.recalculateReadiness, { lead_id: leadId }),

  createRemoteIntake: (payload: RemoteIntakeCreatePayload): Promise<EdgeResult<unknown>> =>
    callEdgeFunction(businessMutationFunctions.createRemoteIntake, payload),

  uploadRemoteIntake: (payload: RemoteIntakeUploadPayload): Promise<EdgeResult<unknown>> =>
    callEdgeFunction(businessMutationFunctions.uploadRemoteIntake, payload),

  createDocumentSignedUrl: (payload: DocumentSignedUrlPayload): Promise<EdgeResult<{ signed_url: string; expires_in: number }>> =>
    callEdgeFunction(businessMutationFunctions.createDocumentSignedUrl, payload),

  validateDocument: (payload: DocumentValidatePayload): Promise<EdgeResult<unknown>> =>
    callEdgeFunction(businessMutationFunctions.validateDocument, payload),

  dispatchSurvey: (payload: SurveyDispatchPayload): Promise<EdgeResult<unknown>> =>
    callEdgeFunction(businessMutationFunctions.dispatchSurvey, payload),

  uploadSurveyEvidence: (payload: SurveyEvidenceUploadPayload): Promise<EdgeResult<unknown>> =>
    callEdgeFunction(businessMutationFunctions.uploadSurveyEvidence, payload),

  generateProposal: (payload: GenerateProposalPayload): Promise<EdgeResult<unknown>> =>
    callEdgeFunction(businessMutationFunctions.generateProposal, payload),

  generateComplianceDocs: (payload: { lead_id: string; actor_role: 'cs' | 'owner'; signer_name: string }): Promise<EdgeResult<unknown>> =>
    callEdgeFunction(businessMutationFunctions.generateComplianceDocs, payload),

  acceptContract: (payload: { token: string; signerName: string }): Promise<EdgeResult<unknown>> =>
    callEdgeFunction(businessMutationFunctions.acceptContract, payload),
};
