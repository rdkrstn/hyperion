import { handleCors } from '../_shared/cors.ts';
import { ApiError, jsonError, jsonOk, readJson, requireString } from '../_shared/errors.ts';
import type { StaffRole } from '../_shared/auth.ts';

export type ComplianceDocumentType = 'net_metering_application' | 'certificate_of_completion';
export const requiredComplianceDocumentTypes: ComplianceDocumentType[] = ['net_metering_application', 'certificate_of_completion'];
export const defaultComplianceRule = { version: 'ph-net-metering-ra11032-v1' };

export type ComplianceDocContext = {
  leadId: string;
  businessName: string;
  contactName: string;
  address: string;
  utilityProvider: string;
  systemSizeKwp: number;
  signerName: string;
  ruleVersion?: string;
};

export type ComplianceTemplate = {
  documentType: ComplianceDocumentType;
  version: string;
  bytes: Uint8Array;
};

export type GeneratedComplianceDocument = {
  documentType: ComplianceDocumentType;
  templateVersion: string;
  storagePath: string;
  sha256: string;
};

export type GenerateComplianceDocsOps = {
  loadContext: (leadId: string, signerName: string) => Promise<ComplianceDocContext>;
  loadTemplate: (documentType: ComplianceDocumentType, ruleVersion: string) => Promise<ComplianceTemplate | undefined>;
  renderPdf: (template: ComplianceTemplate, context: ComplianceDocContext) => Promise<Uint8Array>;
  storePdf: (input: { leadId: string; documentType: ComplianceDocumentType; ruleVersion: string; bytes: Uint8Array }) => Promise<{ storagePath: string; sha256: string }>;
  recordDocuments: (input: { leadId: string; actorRole: StaffRole; signerName: string; ruleVersion: string; documents: GeneratedComplianceDocument[] }) => Promise<unknown>;
};

function assertContext(context: ComplianceDocContext) {
  const missing = [
    context.businessName ? '' : 'business name',
    context.contactName ? '' : 'contact name',
    context.address ? '' : 'address',
    context.utilityProvider ? '' : 'utility provider',
    context.systemSizeKwp > 0 ? '' : 'calculated system size',
    context.signerName ? '' : 'signer metadata',
    context.ruleVersion ? '' : 'compliance rule version',
  ].filter(Boolean);
  if (missing.length) throw new ApiError('bad_request', `Cannot generate compliance PDFs; missing ${missing.join(', ')}.`, 400);
}

export function createGenerateComplianceDocsHandler(ops: GenerateComplianceDocsOps) {
  return async function handleGenerateComplianceDocs(request: Request) {
    const cors = handleCors(request);
    if (cors) return cors;
    if (request.method !== 'POST') return jsonError(new ApiError('method_not_allowed', 'Method not allowed.', 405));

    try {
      const input = await readJson<{ leadId?: string; lead_id?: string; actorRole?: StaffRole; actor_role?: StaffRole; signerName?: string; signer_name?: string }>(request);
      const leadId = requireString(input.leadId ?? input.lead_id, 'lead_id');
      const actorRole = input.actorRole ?? input.actor_role;
      if (actorRole !== 'cs' && actorRole !== 'owner') throw new ApiError('forbidden', 'Only CS or owner can generate compliance documents.', 403);
      const signerName = requireString(input.signerName ?? input.signer_name, 'signerName');

      const context = await ops.loadContext(leadId, signerName);
      const ruleVersion = context.ruleVersion ?? defaultComplianceRule.version;
      const fullContext = { ...context, ruleVersion, signerName };
      assertContext(fullContext);

      const rendered: Array<{ documentType: ComplianceDocumentType; templateVersion: string; bytes: Uint8Array }> = [];
      for (const documentType of requiredComplianceDocumentTypes) {
        const template = await ops.loadTemplate(documentType, ruleVersion);
        if (!template?.bytes?.byteLength) throw new ApiError('not_found', `Missing official template for ${documentType} (${ruleVersion}).`, 404);
        const bytes = await ops.renderPdf(template, fullContext);
        if (!bytes.byteLength) throw new ApiError('internal_error', `Generated PDF was empty for ${documentType}.`, 500);
        rendered.push({ documentType, templateVersion: template.version, bytes });
      }

      const documents: GeneratedComplianceDocument[] = [];
      for (const document of rendered) {
        const stored = await ops.storePdf({ leadId, documentType: document.documentType, ruleVersion, bytes: document.bytes });
        documents.push({ documentType: document.documentType, templateVersion: document.templateVersion, storagePath: stored.storagePath, sha256: stored.sha256 });
      }

      await ops.recordDocuments({ leadId, actorRole, signerName, ruleVersion, documents });
      return jsonOk({ lead_id: leadId, rule_version: ruleVersion, documents });
    } catch (error) {
      return jsonError(error);
    }
  };
}
