export type SurveyEvidenceCategory = 'main_breaker_panel' | 'roof_surface' | 'inverter_location' | 'wire_run_path' | 'meter_area' | 'roof_access' | 'shading_obstruction';

export interface SurveyEvidenceUpload {
  id: string;
  surveyId: string;
  category: SurveyEvidenceCategory;
  fileName: string;
  mimeType: string;
  storagePath: string;
  previewUrl?: string;
  uploadedAt: string;
}

export interface SurveyRecord {
  id: string;
  leadId: string;
  dealId: string;
  installerId: string;
  scheduledAt: string;
  location: string;
  accessInstructions?: string;
  solarSnapshotId?: string;
  evidenceUploads: SurveyEvidenceUpload[];
  isStructurallySound?: boolean;
  findings: {
    roofCondition?: string;
    electricalPanelCondition?: string;
    wireRunComplexity?: string;
    safetyRisks: string[];
    notes?: string;
  };
  validationOutcome: 'scheduled' | 'evidence_pending' | 'blocked' | 'needs_engineering_review' | 'validated' | 'ready_for_proposal';
  blockers: string[];
  createdAt: string;
  updatedAt: string;
}
