export type Role = 'owner' | 'manager' | 'sales' | 'cs' | 'installer';

export type LeadStage =
  | 'captured'
  | 'pre_audit_done'
  | 'survey_assigned'
  | 'survey_completed'
  | 'proposal_ready'
  | 'cs_review'
  | 'owner_review'
  | 'approved'
  | 'nurture';

export type LeadSource =
  | 'Facebook comment'
  | 'Messenger'
  | 'Landing page'
  | 'QR kiosk'
  | 'WhatsApp'
  | 'Phone call'
  | 'Referral';

export type FinancingLane = 'cash' | 'rent_to_own' | 'partner_loan' | 'starter' | 'nurture';

export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done';

export type ReviewDecision = 'pending' | 'approved' | 'changes_requested' | 'rejected';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'gcash_maya' | 'card' | 'partner_loan' | 'rent_to_own';

export type BillingAmountType = 'deposit' | 'milestone' | 'custom' | 'full';

export type BillingStatus = 'not_started' | 'mock_pending' | 'mock_succeeded' | 'mock_failed';

export type OpportunityStatus = 'open' | 'won' | 'lost' | 'cancelled' | 'archived';

export type ArchiveState = 'active' | 'archived';

export type RefundStatus = 'requested' | 'owner_approved' | 'processing' | 'completed' | 'rejected' | 'cancelled';

export type QualificationStatus = 'new_inquiry' | 'qualifying' | 'qualified' | 'nurture' | 'disqualified';

export type QualificationSectionId =
  | 'inquiry'
  | 'business_fit'
  | 'bill_energy'
  | 'site_control'
  | 'financing_fit'
  | 'decision_timeline'
  | 'docs'
  | 'notes';

export interface QualificationSection {
  id: QualificationSectionId;
  label: string;
  required: boolean;
}

export type QualificationAnswerMap = Partial<Record<QualificationSectionId, boolean>>;

export interface QualificationRecord {
  status: QualificationStatus;
  score: number;
  missingSections: QualificationSectionId[];
  overrideNote?: string;
  updatedAt: string;
}

export type TicketCategory = 'qualification' | 'survey' | 'billing' | 'financing' | 'customer_success' | 'owner_review';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'cancelled';
export type LinkedRecordType = 'lead' | 'client' | 'survey' | 'billing' | 'financing' | 'ticket' | 'owner_review' | 'document';

export interface TicketComment {
  id: string;
  body: string;
  authorRole: Role;
  createdAt: string;
}

export interface TicketRecord {
  id: string;
  linkedRecordType: LinkedRecordType;
  linkedRecordId: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  title: string;
  ownerRole: Role;
  assigneeName: string;
  dueAt: string;
  comments: TicketComment[];
  createdAt: string;
}

export type CalendarEventType = 'survey' | 'installation' | 'follow_up' | 'ticket' | 'owner_review' | 'billing';

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  linkedRecordType: LinkedRecordType;
  linkedRecordId: string;
  startAt: string;
  endAt: string;
  ownerRole: Role;
  location?: string;
  notes?: string;
}

export type SurveyUploadCategory = 'main_breaker_panel' | 'roof_surface' | 'inverter_location' | 'wire_run_path' | 'roof_photos' | 'meter_service' | 'shading_obstructions' | 'bill_docs' | 'site_access';
export type SurveyApprovalStatus = 'pending_uploads' | 'pending_cs_validation' | 'installer_validated' | 'cs_validated' | 'owner_approved' | 'changes_requested';

export interface SurveyUpload {
  id: string;
  surveyJobId: string;
  category: SurveyUploadCategory;
  fileName: string;
  storagePath: string;
  uploadedByRole: Role;
  uploadedAt: string;
  previewUrl?: string;
}

export interface SurveyEvidenceRequirement {
  category: SurveyUploadCategory;
  label: string;
  required: boolean;
}

export interface SurveyApproval {
  id: string;
  surveyJobId: string;
  status: SurveyApprovalStatus;
  csValidatedBy?: Role;
  ownerReviewedBy?: Role;
  notes: string;
  updatedAt: string;
}

export type BillingLedgerEventType = 'invoice_created' | 'mock_payment_attempt' | 'payment_status_updated' | 'refund_requested' | 'refund_status_updated' | 'receipt_recorded';

export type DaytimeUsageLevel = 'low' | 'medium' | 'high';
export type RoofOwnership = 'owned' | 'rented_with_authorization' | 'rented_needs_authorization';
export type RoofType = 'concrete' | 'metal' | 'tile' | 'ground_mount' | 'needs_review';
export type BudgetPreference = 'cash' | 'loan' | 'lease_to_own' | 'group_buy';
export type ReadinessUploadCategory = 'bill' | 'roof_photo';
export type InstallerSurveyPriority = 'low' | 'medium' | 'high';
export type RiskLevel = 'low' | 'medium' | 'high';
export type FinancingPacketStatus = 'draft' | 'missing_requirements' | 'ready_for_lender' | 'submitted' | 'lender_feedback' | 'approved' | 'declined';
export type NetMeteringStepId = 'eligibility' | 'documents' | 'technical_review' | 'application' | 'metering' | 'active_credits';
export type NetMeteringStepStatus = 'not_started' | 'in_progress' | 'blocked' | 'complete';
export type NotificationSeverity = 'info' | 'warning' | 'success';
export type ActionStatus = 'idle' | 'pending' | 'success' | 'error';
export type QuoteRequestStatus = 'requested' | 'reviewing' | 'approved' | 'converted_to_checkout' | 'rejected' | 'cancelled';
export type AiSummaryType = 'report' | 'opportunity' | 'ticket' | 'packet';
export type LocationConfidence = 'gps' | 'fallback' | 'places_confirmed' | 'pin_confirmed' | 'maps_pending';
export type BillOcrProvider = 'google_vision';
export type AutomationEventType =
  | 'lead_captured'
  | 'bill_uploaded'
  | 'ocr_completed'
  | 'pre_audit_completed'
  | 'packet_drafted'
  | 'deal_room_viewed'
  | 'deal_room_quote_requested'
  | 'remote_intake_generated'
  | 'remote_intake_uploaded'
  | 'maps_enrichment_pending'
  | 'maps_enrichment_completed'
  | 'installer_route_plan_created'
  | 'compliance_documents_generated'
  | 'compliance_ready_for_lender';
export type DealRoomStatus = 'active' | 'paused' | 'expired';
export type DealRoomEventType = 'viewed' | 'section_opened' | 'quote_requested' | 'expired' | 'paused';
export type QualificationProgressState = 'complete' | 'missing' | 'needs_review' | 'blocked' | 'overridden';
export type StageGateActionId =
  | 'complete_qualification'
  | 'run_pre_audit'
  | 'rerun_pre_audit'
  | 'assign_survey'
  | 'view_survey'
  | 'complete_survey'
  | 'open_checkout'
  | 'generate_deal_room'
  | 'open_deal_room'
  | 'submit_cs_review'
  | 'owner_approve'
  | 'view_status';
export type RemoteIntakeStatus = 'generated' | 'sent' | 'pending_upload' | 'completed' | 'expired' | 'paused';
export type RemoteIntakeUploadCategory = 'customer_bill' | 'valid_id' | 'site_control_document';
export type GeoEnrichmentStatus = 'ready' | 'maps_pending' | 'failed';
export type EngineeringRemediationStatus = 'not_required' | 'required' | 'plan_requested' | 'plan_approved';
export type NetMeteringWorkflowStatus = 'not_started' | 'documents_pending' | 'technical_review' | 'compliance_docs_generated' | 'ready_for_lender' | 'submitted' | 'active_credits';
export type ComplianceDocumentType = 'net_metering_application' | 'certificate_of_completion';
export type ComplianceSlaStatus = 'not_submitted' | 'in_progress' | 'deemed_approved' | 'actual_document_received';
export type SolarReviewStatus = GeoEnrichmentStatus | 'override_requested' | 'override_approved';
export type DealFileCategory =
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
export type DealFileSource = 'staff_upload' | 'remote_intake' | 'installer_upload' | 'system_generated';
export type DealFileValidationStatus = 'pending_validation' | 'validated' | 'rejected';
export type QuoteApprovalStatus = 'draft' | 'needs_pricing_approval' | 'approved' | 'frozen' | 'contract_generated' | 'accepted';
export type QuoteLineSource = 'solar_api' | 'pre_audit' | 'survey' | 'catalog' | 'manual';
export type LeadLifecycleStatus = 'captured' | 'qualified' | 'deal_created';
export type DealLifecycleStage =
  | 'deal_created'
  | 'solar_snapshot_reviewed'
  | 'survey_scheduled'
  | 'survey_validated'
  | 'proposal_built'
  | 'client_portal_shared'
  | 'contract_accepted'
  | 'won';
export type DealCommercialStatus = 'open' | 'won' | 'lost' | 'cancelled' | 'archived';
export type SurveyOutcome = 'scheduled' | 'evidence_pending' | 'blocked' | 'needs_engineering_review' | 'validated' | 'ready_for_proposal';
export type ProposalOutcome = 'draft' | 'pricing_review_needed' | 'approved' | 'shared' | 'accepted' | 'rejected';
export type DocumentOwnerType = 'lead' | 'deal' | 'survey' | 'client' | 'proposal';
export type TimelineOwnerType = 'lead' | 'deal' | 'survey' | 'document' | 'proposal';

export interface LeadRecord {
  id: string;
  code: string;
  lifecycleStatus: LeadLifecycleStatus;
  source: LeadSource;
  businessName: string;
  contactName: string;
  contactInfo: string;
  location: string;
  utilityProvider: string;
  customerType: string;
  monthlyBill: number;
  monthlyKwh?: number;
  daytimeUsage: string;
  operatingHours: string;
  brownoutConcern: boolean;
  batteryInterest: boolean;
  currentBackupSetup: string;
  goal: string;
  siteControl: string;
  paymentPreference: string;
  qualification: QualificationRecord;
  readinessScore: number;
  solarFit: string;
  recommendedSystemRange: string;
  estimatedSavingsRange: string;
  paybackEstimate: string;
  riskLevel: RiskLevel;
  missingRequirements: string[];
  nextBestAction: string;
  assignedSales: string;
  createdAt: string;
}

export interface LeadSnapshot {
  leadId: string;
  businessName: string;
  contactName: string;
  location: string;
  monthlyBill: number;
  goal: string;
  utilityProvider: string;
  paymentPreference: string;
  readinessScore: number;
}

export interface CommercialPacket {
  proposedSystemSizeKwp: number;
  packageName: string;
  addOns: string[];
  estimatedPrice: number;
  marginEstimate: number;
  paymentOption: string;
  discounts: number;
  proposalStatus: ProposalOutcome;
  contractStatus: ContractRecord['status'] | 'not_started';
}

export interface DealRecord {
  id: string;
  name: string;
  leadId: string;
  leadSnapshot: LeadSnapshot;
  value: number;
  stage: DealLifecycleStage;
  status: DealCommercialStatus;
  source: LeadSource;
  salesOwner: string;
  createdAt: string;
  expectedCloseDate: string;
  surveyStatus: SurveyOutcome;
  proposalStatus: ProposalOutcome;
  portalStatus: DealRoomStatus | 'not_shared';
  winLossStatus: DealCommercialStatus;
  commercialPacket: CommercialPacket;
  blocker?: string;
  nextAction: string;
}

export interface SolarSnapshot {
  id: string;
  leadId: string;
  dealId?: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
  utilityProvider: string;
  imageryStatus: GeoEnrichmentStatus;
  imageryQuality: string;
  roofCapacityKwp: number;
  maxPanels: number;
  annualProductionKwh: number;
  pitch?: number;
  azimuth?: number;
  shadingFlag: boolean;
  riskFlag: string;
  dispatchGate: SolarReviewStatus;
  manualOverrideStatus?: SolarReviewStatus;
  lastReviewedAt?: string;
}

export interface SurveyRecord {
  id: string;
  dealId: string;
  leadId: string;
  installer: string;
  schedule: string;
  location: string;
  mapPin: string;
  accessInstructions: string;
  solarSnapshotId?: string;
  evidenceStatus: SurveyOutcome;
  validationOutcome: SurveyOutcome;
  blockers: string[];
  roofCondition: SurveyJob['roofCondition'];
  electricalPanelCondition: string;
  wireRunComplexity: string;
  safetyRisks: string[];
  recommendedSystemAdjustment?: string;
  requiresEngineerReview: boolean;
  installerNotes: string;
}

export interface DocumentRecord {
  id: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  category: DealFileCategory;
  fileName: string;
  mimeType: string;
  bucket: string;
  storagePath: string;
  source: DealFileSource;
  validationStatus: DealFileValidationStatus;
  uploadedAt: string;
  validatedAt?: string;
  rejectionReason?: string;
}

export interface ProposalRecord {
  id: string;
  dealId: string;
  status: ProposalOutcome;
  scopeLines: EstimateLineItem[];
  total: number;
  marginPercent: number;
  paymentOption: PaymentMethod;
  contractReady: boolean;
  clientFacingState: 'not_shared' | 'shared' | 'accepted';
}

export interface ClientPortal {
  id: string;
  dealId: string;
  token: string;
  publicUrl: string;
  status: DealRoomStatus;
  lastViewedAt?: string;
  documentsUploaded: number;
  proposalAccepted: boolean;
  contractSigned: boolean;
}

export interface TimelineEvent {
  id: string;
  ownerType: TimelineOwnerType;
  ownerId: string;
  title: string;
  description: string;
  actorRole: Role | 'system' | 'client';
  createdAt: string;
}

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface QualificationProgressItem {
  sectionId: QualificationSectionId;
  label: string;
  required: boolean;
  complete: boolean;
  state: QualificationProgressState;
  badge: string;
  directive: string;
}

export interface StageGateAction {
  id: StageGateActionId;
  label: string;
  enabled: boolean;
  reason: string;
  targetPath?: string;
}

export interface StageGateViewModel {
  stage: LeadStage;
  headline: string;
  primaryAction: StageGateAction;
  secondaryActions: StageGateAction[];
}

export interface RemoteIntakeUpload {
  id: string;
  category: RemoteIntakeUploadCategory;
  fileName: string;
  storagePath?: string;
  uploadedAt: string;
  uploadedBy: 'remote-client' | Role;
}

export interface RemoteIntakeEvent {
  id: string;
  eventType: 'generated' | 'sent' | 'viewed' | 'uploaded' | 'completed' | 'expired' | 'paused';
  actorRole?: Role;
  createdAt: string;
}

export interface RemoteIntakeLink {
  id: string;
  dealId: string;
  businessName: string;
  token: string;
  accessJwt?: string;
  publicUrl: string;
  status: RemoteIntakeStatus;
  expiresAt: string;
  sentAt?: string;
  sentByRole?: Role;
  createdAt: string;
  uploads: RemoteIntakeUpload[];
  events: RemoteIntakeEvent[];
}

export interface RemoteIntakeJwtClaims {
  token: string;
  dealId: string;
  exp: number;
  scope: 'remote_intake';
}

export interface GeoAddress {
  formattedAddress: string;
  placeId?: string;
  source: 'manual' | 'places' | 'geocode';
  status: GeoEnrichmentStatus;
}

export interface GeoPin {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  confidence: LocationConfidence;
  staticMapUrl?: string;
}

export interface SolarBuildingInsights {
  id: string;
  status: GeoEnrichmentStatus;
  sourceName?: string;
  imageryQuality?: 'HIGH' | 'MEDIUM' | 'BASE';
  maxUsableAreaMeters2?: number;
  historicalIrradiance?: number;
  roofPitchDegrees?: number;
  roofAreaMeters2?: number;
  maxPanels?: number;
  panelCapacityWatts?: number;
  maxSystemSizeKwp?: number;
  maxSunshineHoursPerYear?: number;
  yearlyEnergyDcKwh?: number;
  roofSegments: Array<{ pitchDegrees: number; azimuthDegrees: number; areaMeters2: number }>;
  riskFlags: string[];
  verifiedAt?: string;
  ownerOverrideAt?: string;
  ownerOverrideReason?: string;
  createdAt: string;
}

export interface SolarDispatchOverride {
  status: 'requested' | 'approved' | 'rejected';
  requestedByRole: Role;
  requestedAt: string;
  requestReason: string;
  reviewedByRole?: Role;
  reviewedAt?: string;
  reviewReason?: string;
}

export interface SolarDispatchGate {
  allowed: boolean;
  status: SolarReviewStatus;
  reason: string;
  nextAction: string;
}

export interface InstallerRouteStop {
  dealId: string;
  surveyJobId: string;
  label: string;
  latitude?: number;
  longitude?: number;
  durationMinutes?: number;
  distanceKm?: number;
}

export interface InstallerRoutePlan {
  id: string;
  installerId: string;
  status: 'ready' | 'maps_pending' | 'failed';
  origin: { latitude?: number; longitude?: number };
  orderedStops: InstallerRouteStop[];
  createdAt: string;
}

export interface SurveyScheduleInput {
  assignedInstaller: string;
  scheduledAt: string;
  location: string;
  notes?: string;
}

export interface InstallationJob {
  id: string;
  dealId: string;
  assignedInstaller: string;
  scheduledAt: string;
  location: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  calendarEventId: string;
}

export interface SurveyGateResult {
  allowed: boolean;
  reason: string;
  severity: 'info' | 'warning' | 'error';
  missingEvidence: SurveyUploadCategory[];
}

export interface SurveyUploadPreview {
  category: SurveyUploadCategory;
  fileName: string;
  previewUrl?: string;
  uploaded: boolean;
}

export interface InstallerValidationPayload {
  main_breaker_photo?: string;
  roof_surface_photo?: string;
  inverter_location_photo?: string;
  wire_run_path_photo?: string;
  is_structurally_sound?: boolean | null;
  validatedAt?: string;
  validatedByRole?: Role;
}

export interface ReadinessIntake {
  businessName: string;
  contactName: string;
  location: string;
  utilityProvider: string;
  businessType: string;
  monthlyElectricityBill: number;
  operatingHours: string;
  daytimeUsageLevel: DaytimeUsageLevel;
  roofOwnership: RoofOwnership;
  roofType: RoofType;
  budgetPreference: BudgetPreference;
  batteryInterest: boolean;
  groupBuyInterest: boolean;
  billUploadFileName?: string;
  internalNotes?: string;
  assignedSales?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracyMeters?: number;
  locationConfidence?: LocationConfidence;
  placeId?: string;
  standardizedAddress?: string;
}

export interface FieldCaptureIntake extends ReadinessIntake {
  capturedAtGate: boolean;
}

export interface BillOcrResult {
  provider: BillOcrProvider;
  rawText: string;
  averageMonthlyKwh: number;
  monthlyBillAmount: number;
  utilityProvider: string;
  extractionConfidence: number;
  manualReviewRequired: boolean;
  riskFlags: string[];
}

export interface BillOcrJob {
  id: string;
  leadId?: string;
  provider: BillOcrProvider;
  sourceFileName: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'manual_review';
  result?: BillOcrResult;
  error?: string;
  createdAt: string;
}

export interface AutomationEvent {
  id: string;
  eventType: AutomationEventType;
  linkedRecordType: LinkedRecordType;
  linkedRecordId: string;
  payload: Record<string, string | number | boolean | null>;
  status: 'logged' | 'ready_for_external_sync';
  createdAt: string;
}

export interface PreAuditRun {
  id: string;
  leadId?: string;
  readinessScore: number;
  nextStage: LeadStage;
  preAudit: PreAuditSnapshot;
  financingPacketStatus: FinancingPacketStatus;
  automationEvents: AutomationEvent[];
  createdAt: string;
}

export interface InstallerScorecard {
  leadScore: number;
  billRange: string;
  roofReadiness: string;
  financingIntent: string;
  missingDocuments: string[];
  estimatedProjectValue: number;
  riskLevel: RiskLevel;
  nextBestAction: string;
}

export interface InstallerWorkSummary {
  leadScore: number;
  monthlyBillRange: string;
  roofReadiness: string;
  financingIntent: string;
  missingDocuments: string[];
  estimatedProjectValue: number;
  riskLevel: RiskLevel;
  nextBestAction: string;
  quoteStatus: QuoteRequestStatus | 'none';
  netMeteringStatus: NetMeteringStepStatus;
}

export interface ReadinessResult {
  id: string;
  readinessScore: number;
  recommendedSystemSizeKwp: number;
  monthlySavingsLow: number;
  monthlySavingsHigh: number;
  paybackYearsLow: number;
  paybackYearsHigh: number;
  leaseToOwnComparison: string;
  netMeteringChecklist: string[];
  installerSurveyPriority: InstallerSurveyPriority;
  lenderPacketStatus: FinancingPacketStatus;
  cooperativeOption: string;
  installerScorecard: InstallerScorecard;
  createdAt: string;
}

export interface ReadinessUpload {
  id: string;
  leadId: string;
  category: ReadinessUploadCategory;
  fileName: string;
  storagePath: string;
  uploadedAt: string;
}

export interface DealFile {
  id: string;
  dealId: string;
  category: DealFileCategory;
  source: DealFileSource;
  linkedRecordType: LinkedRecordType;
  linkedRecordId: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  bucket: string;
  uploadedByRole: Role | 'remote-client' | 'system';
  uploadedAt: string;
  validationStatus: DealFileValidationStatus;
  validatedByRole?: Role;
  validatedAt?: string;
  rejectionReason?: string;
  previewUrl?: string;
  auditTrail: Array<{ actor: Role | 'remote-client' | 'system'; action: string; note: string; createdAt: string }>;
}

export interface FileRequirement {
  category: DealFileCategory;
  label: string;
  required: boolean;
  satisfied: boolean;
  status: DealFileValidationStatus | 'missing';
}

export interface NetMeteringStep {
  id: NetMeteringStepId;
  status: NetMeteringStepStatus;
  customerLabel: string;
  adminLabel: string;
  missingItems: string[];
  updatedAt: string;
}

export interface NetMeteringWorkflow {
  id: string;
  leadId?: string;
  status: NetMeteringWorkflowStatus;
  utilityProvider: string;
  location: string;
  ownershipFlag: RoofOwnership;
  systemSizeKwp: number;
  electricalPermitSubmittedAt?: string;
  cfeiSubmittedAt?: string;
  readyForLenderAt?: string;
  ownerReadyOverrideAt?: string;
  ownerReadyOverrideReason?: string;
  steps: NetMeteringStep[];
  createdAt: string;
}

export interface NetMeteringGateResult {
  allowed: boolean;
  reason: string;
  missingItems: string[];
}

export interface QuoteRequest {
  id: string;
  dealId: string;
  status: QuoteRequestStatus;
  requestedBy: Role;
  requestedAt: string;
  reviewedBy?: Role;
  reviewedAt?: string;
  convertedAt?: string;
  note: string;
  rejectionReason?: string;
}

export interface AiSummary {
  id: string;
  type: AiSummaryType;
  title: string;
  body: string;
  linkedRecordType?: LinkedRecordType;
  linkedRecordId?: string;
  createdByRole: Role;
  createdAt: string;
}

export interface FinancingPacket {
  id: string;
  leadId?: string;
  status: FinancingPacketStatus;
  billSummary12Month: string;
  estimatedSystemSizeKwp: number;
  estimatedSavingsRange: string;
  paybackRange: string;
  affordabilityProfile: string;
  siteReadinessScore: number;
  installerQuote: number;
  netMeteringStatus: string;
  riskFlags: string[];
  missingRequirements: string[];
  createdAt: string;
}

export interface ComplianceRule {
  id: string;
  version: string;
  title: string;
  sourceNotes: string[];
  electricalPermitWorkingDays: number;
  cfeiWorkingDays: number;
  effectiveAt: string;
}

export interface ComplianceDocument {
  id: string;
  leadId: string;
  documentType: ComplianceDocumentType;
  templateVersion: string;
  storagePath: string;
  sha256: string;
  generatedByRole: Role;
  signerName: string;
  ruleVersion: string;
  createdAt: string;
}

export interface ProfilePreferences {
  notifyInApp: boolean;
  notifyLeadUpdates: boolean;
  notifySurveyUpdates: boolean;
  notifyFinancingUpdates: boolean;
  notifyOwnerApprovals: boolean;
}

export interface NotificationRecord {
  id: string;
  title: string;
  body: string;
  targetRole?: Role;
  targetProfileId?: string;
  linkedRecordType: LinkedRecordType;
  linkedRecordId: string;
  severity: NotificationSeverity;
  readAt?: string;
  createdAt: string;
}

export interface BillingLedgerEvent {
  id: string;
  linkedRecordId: string;
  eventType: BillingLedgerEventType;
  amount: number;
  providerMode: 'mock';
  actorRole: Role;
  note: string;
  createdAt: string;
}

export interface AnalyticsReportSnapshot {
  id: string;
  title: string;
  summary: string;
  metrics: Record<string, number | string>;
  createdByRole: Role;
  status: 'draft' | 'embedded';
  createdAt: string;
}

export interface ReportEmbeddingChunk {
  id: string;
  reportId: string;
  content: string;
  embedding: number[];
  model: 'text-embedding-3-small';
  createdAt: string;
}

export interface RepositoryResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface LeadInput {
  source: LeadSource;
  businessName: string;
  contactName: string;
  location: string;
  businessType: string;
  averageMonthlyBill: number;
  tariff: number;
  productionPerKwp: number;
  pricePerKwp: number;
  propertyControl: 'Owns property' | 'Leases with owner authorization' | 'Rents / no authorization yet';
  yearsInBusiness: '5+ years' | '2-5 years' | 'Less than 2 years';
  revenueBand: '₱500k+ / month' | '₱150k-₱500k / month' | 'Below ₱150k / month' | 'Prefer not to say';
  paymentBehavior: 'Consistent / current' | 'Occasional delays' | 'Unknown';
  purchaseTimeline: '0-30 days' | '1-3 months' | '3-6 months' | 'Just researching';
  interestLevel: 'Ready for site survey' | 'Wants quote first' | 'Curious / price checking';
  preferredSurveySlot: string;
  staffNotes: string;
}

export type LeadFormInput = LeadInput;

export interface PreAuditSnapshot {
  monthlyKwh: number;
  targetOffset: number;
  sizeKwp: number;
  monthlyProduction: number;
  projectedSavings: number;
  capex: number;
  paybackYears: number;
  rtoDownpayment: number;
  rtoMonthly: number;
  bankDownpayment: number;
  bankMonthly: number;
}

export interface ScoreBreakdownItem {
  label: string;
  points: number;
  note: string;
}

export interface LeadScore {
  score: number;
  lane: FinancingLane;
  priority: boolean;
  breakdown: ScoreBreakdownItem[];
}

export interface SurveyJob {
  id: string;
  assignedInstaller: string;
  scheduledAt: string;
  roofCondition: 'Pending' | 'Good condition' | 'Minor repair needed' | 'Engineering review required';
  shading: 'Pending' | 'Minimal shading' | 'Moderate shading' | 'Heavy shading';
  usableRoofArea: string;
  mapPin: string;
  siteAccessNotes: string;
  photoPlaceholders: string[];
  roofStructurallySound?: boolean | null;
  installerValidationPayload?: InstallerValidationPayload;
  evidenceLockedAt?: string;
  completed: boolean;
}

export interface ProposalSnapshot {
  id: string;
  quoteNumber: string;
  systemSizeKwp: number;
  projectPrice: number;
  projectedSavings: number;
  grossMarginPercent: number;
  status: 'draft' | 'ready' | 'accepted';
  frozenHtml?: string;
  mockCheckoutLink?: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  amount: number;
  paymentStatus: 'not_sent' | 'sent' | 'deposit_pending' | 'deposit_paid' | 'paid';
  receiptReference: string;
  contractId?: string;
  paymentMethod?: PaymentMethod;
  billingAmount?: number;
  billingStatus?: BillingStatus;
}

export interface SolarCatalogItem {
  id: string;
  category: 'panel' | 'inverter' | 'mounting' | 'electrical' | 'permit' | 'labor' | 'adder';
  name: string;
  description: string;
  unit: string;
  defaultShare: number;
  optional: boolean;
}

export interface QuoteScopeLine {
  id: string;
  catalogItemId: string;
  category: SolarCatalogItem['category'];
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  estimatedCost: number;
  marginPercent: number;
  total: number;
  optional: boolean;
  source: QuoteLineSource;
  sourceReason: string;
  notes: string;
  manuallyEdited: boolean;
}

export type EstimateLineItem = QuoteScopeLine;

export interface CheckoutEstimate {
  id: string;
  dealId: string;
  status: QuoteApprovalStatus;
  lineItems: EstimateLineItem[];
  subtotal: number;
  grossMarginPercent: number;
  total: number;
  totalEstimatedCost: number;
  approvalStatus: QuoteApprovalStatus;
  pricingApprovedBy?: Role;
  pricingApprovedAt?: string;
  pricingApprovalNote?: string;
  frozenAt?: string;
  paymentMethod: PaymentMethod;
  billingAmountType: BillingAmountType;
  billingAmount: number;
  createdAt: string;
}

export interface ContractAcceptance {
  id: string;
  signerName: string;
  acceptedAt: string;
  token: string;
  contractVersion: string;
  paymentMethod: PaymentMethod;
  acceptedAmount: number;
}

export interface ContractRecord {
  id: string;
  dealId: string;
  estimateId: string;
  token: string;
  version: string;
  lane: FinancingLane;
  status: 'draft' | 'sent' | 'signed' | 'expired';
  templateTitle: string;
  terms: string[];
  publicUrl: string;
  createdAt: string;
  signedAt?: string;
  acceptance?: ContractAcceptance;
}

export interface CheckoutPreflight {
  blockers: string[];
  checks: Array<{ key: string; label: string; passed: boolean; detail: string }>;
  canGenerateQuote: boolean;
  readyForContract: boolean;
}

export interface DealRoomFinancingOption {
  label: string;
  monthlyAmount: number;
  note: string;
}

export interface DealRoomQuoteRequestInput {
  contactName: string;
  phone: string;
  note?: string;
}

export interface DealRoomEvent {
  id: string;
  dealRoomId: string;
  eventType: DealRoomEventType;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface DealRoom {
  id: string;
  dealId: string;
  token: string;
  status: DealRoomStatus;
  publicUrl: string;
  sections: {
    readinessScore: number;
    recommendedSystemSizeKwp: number;
    savingsRange: string;
    paybackRange: string;
    leaseToOwnComparison: string;
    netMeteringChecklist: string[];
    lenderPacketStatus: FinancingPacketStatus;
    installerReadiness: string;
    valueStory: string;
    financingOptions: string[];
  };
  events: DealRoomEvent[];
  quoteRequest?: {
    status: QuoteRequestStatus;
    input: DealRoomQuoteRequestInput;
    requestedAt: string;
  };
  createdAt: string;
}

export interface BillingTransaction {
  id: string;
  invoiceId: string;
  contractId: string;
  provider: 'mock';
  paymentMethod: PaymentMethod;
  amount: number;
  status: BillingStatus;
  reference: string;
  createdAt: string;
}

export interface CancellationRecord {
  id: string;
  reason: string;
  status: 'requested' | 'cancelled';
  requestedBy: Role;
  requestedAt: string;
  notes: string;
}

export interface RefundRecord {
  id: string;
  amount: number;
  status: RefundStatus;
  reason: string;
  requestedBy: Role;
  requestedAt: string;
  ownerDecisionBy?: Role;
  ownerDecisionAt?: string;
  notes: string;
}

export interface FinancingReview {
  id: string;
  lane: FinancingLane;
  reviewStatus: 'not_started' | 'packet_ready' | 'under_review' | 'approved_to_submit' | 'not_eligible';
  missingDocs: string[];
  packetSummary: string;
}

export interface TaskItem {
  id: string;
  ownerRole: Role;
  title: string;
  status: TaskStatus;
  dueLabel: string;
}

export interface StageEvent {
  id: string;
  stage: LeadStage;
  actorRole: Role;
  note: string;
  createdAt: string;
}

export interface OwnerReview {
  id: string;
  decision: ReviewDecision;
  marginApproved: boolean;
  notes: string;
}

export interface AiSuggestion {
  id: string;
  type: 'summary' | 'follow_up' | 'task' | 'missing_info';
  title: string;
  body: string;
  approved: boolean;
}

export interface DocumentChecklist {
  electricBills: boolean;
  businessRegistration: boolean;
  validId: boolean;
  locationPin: boolean;
  roofAccess: boolean;
}

export interface Deal {
  id: string;
  code: string;
  stage: LeadStage;
  opportunityStatus: OpportunityStatus;
  archiveState: ArchiveState;
  archivedAt?: string;
  lead: LeadInput;
  readinessIntake?: ReadinessIntake;
  readinessResult?: ReadinessResult;
  readinessUploads: ReadinessUpload[];
  remoteIntakeLink?: RemoteIntakeLink;
  geoAddress?: GeoAddress;
  geoPin?: GeoPin;
  solarInsights?: SolarBuildingInsights;
  solarDispatchOverride?: SolarDispatchOverride;
  installerRoutePlan?: InstallerRoutePlan;
  dealFiles?: DealFile[];
  financingPacket?: FinancingPacket;
  netMeteringWorkflow?: NetMeteringWorkflow;
  complianceRule?: ComplianceRule;
  complianceDocuments?: ComplianceDocument[];
  complianceHolidays?: string[];
  qualification: QualificationRecord;
  assignedSales: string;
  preAudit?: PreAuditSnapshot;
  score?: LeadScore;
  surveyJob?: SurveyJob;
  installationJob?: InstallationJob;
  engineeringRemediationStatus?: EngineeringRemediationStatus;
  checkoutEstimate?: CheckoutEstimate;
  quoteRequests: QuoteRequest[];
  dealRoom?: DealRoom;
  billOcrJob?: BillOcrJob;
  preAuditRuns?: PreAuditRun[];
  automationEvents?: AutomationEvent[];
  contract?: ContractRecord;
  proposal?: ProposalSnapshot;
  invoice?: InvoiceRecord;
  billingTransaction?: BillingTransaction;
  billingLedger: BillingLedgerEvent[];
  financingReview?: FinancingReview;
  cancellation?: CancellationRecord;
  refund?: RefundRecord;
  documents: DocumentChecklist;
  surveyUploads: SurveyUpload[];
  surveyApproval?: SurveyApproval;
  csReady: boolean;
  ownerReview?: OwnerReview;
  tasks: TaskItem[];
  aiSuggestions: AiSuggestion[];
  events: StageEvent[];
}

export interface ClientRecord {
  id: string;
  businessName: string;
  contactName: string;
  location: string;
  status: 'prospect' | 'qualified' | 'proposal' | 'active_client' | 'on_hold';
  linkedDealId: string;
  commercialValue: number;
  nextAction: string;
  archiveState: ArchiveState;
  archivedAt?: string;
}

export interface ClientFormInput {
  businessName: string;
  contactName: string;
  location: string;
  status: ClientRecord['status'];
  linkedDealId: string;
  commercialValue: number;
  nextAction: string;
}

export interface StaffProfile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
  focus: string;
  phone?: string;
  avatarInitials?: string;
  preferences?: ProfilePreferences;
}

export type AppAction =
  | 'create_lead'
  | 'qualify_lead'
  | 'run_pre_audit'
  | 'assign_survey'
  | 'complete_survey'
  | 'upload_survey_evidence'
  | 'validate_survey'
  | 'approve_survey'
  | 'manage_checkout'
  | 'manage_quote_request'
  | 'generate_proposal'
  | 'manage_invoice'
  | 'manage_billing_ledger'
  | 'manage_client'
  | 'manage_ticket'
  | 'manage_calendar'
  | 'review_analytics'
  | 'archive_record'
  | 'request_cancellation'
  | 'request_refund'
  | 'approve_refund'
  | 'submit_owner_review'
  | 'approve_owner_review'
  | 'view_all_dashboards'
  | 'approve_ai_suggestion';
