import { describe, expect, it } from 'vitest';
import { createGenerateComplianceDocsHandler, defaultComplianceRule, requiredComplianceDocumentTypes, type GenerateComplianceDocsOps } from '../../supabase/functions/generate-compliance-docs/handler';

describe('generate-compliance-docs Edge Function handler', () => {
  it('generates both official compliance document records when all deterministic inputs exist', async () => {
    const ops: GenerateComplianceDocsOps = {
      loadContext: async (leadId, signerName) => ({
        leadId,
        businessName: 'MSME Bakery',
        contactName: 'Nina Cruz',
        address: 'Iloilo City',
        utilityProvider: 'MORE Power',
        systemSizeKwp: 8.5,
        signerName,
        ruleVersion: defaultComplianceRule.version,
      }),
      loadTemplate: async (documentType, ruleVersion) => ({ documentType, version: ruleVersion, bytes: new Uint8Array([1, 2, 3]) }),
      renderPdf: async () => new Uint8Array([4, 5, 6]),
      storePdf: async ({ leadId, documentType, ruleVersion }) => ({
        storagePath: `${leadId}/${documentType}-${ruleVersion}.pdf`,
        sha256: `${documentType}-hash`,
      }),
      recordDocuments: async () => undefined,
    };

    const response = await createGenerateComplianceDocsHandler(ops)(new Request('https://functions.local/generate-compliance-docs', {
      method: 'POST',
      body: JSON.stringify({ leadId: 'lead-001', actorRole: 'cs', signerName: 'Nina Cruz' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.documents.map((document: { documentType: string }) => document.documentType)).toEqual(requiredComplianceDocumentTypes);
    expect(body.data.documents[0].sha256).toContain('hash');
  });

  it('fails closed without generating partial PDFs when a template is missing', async () => {
    const stored: string[] = [];
    const ops: GenerateComplianceDocsOps = {
      loadContext: async (leadId, signerName) => ({
        leadId,
        businessName: 'MSME Bakery',
        contactName: 'Nina Cruz',
        address: 'Iloilo City',
        utilityProvider: 'MORE Power',
        systemSizeKwp: 8.5,
        signerName,
        ruleVersion: defaultComplianceRule.version,
      }),
      loadTemplate: async (documentType, ruleVersion) => (
        documentType === 'net_metering_application'
          ? { documentType, version: ruleVersion, bytes: new Uint8Array([1]) }
          : undefined
      ),
      renderPdf: async () => new Uint8Array([4]),
      storePdf: async ({ documentType }) => {
        stored.push(documentType);
        return { storagePath: `${documentType}.pdf`, sha256: 'hash' };
      },
      recordDocuments: async () => undefined,
    };

    const response = await createGenerateComplianceDocsHandler(ops)(new Request('https://functions.local/generate-compliance-docs', {
      method: 'POST',
      body: JSON.stringify({ leadId: 'lead-001', actorRole: 'cs', signerName: 'Nina Cruz' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error.message).toContain('Missing official template');
    expect(stored).toEqual([]);
  });
});
