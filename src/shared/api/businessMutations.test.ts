import { describe, expect, it } from 'vitest';
import { businessMutationFunctions } from './businessMutations';
import { edgeFunctionUrl } from './edgeFunctionClient';

describe('business mutation Edge Function boundary', () => {
  it('maps production business mutations to Supabase Edge Functions', () => {
    expect(businessMutationFunctions).toEqual({
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
    });
  });

  it('builds Supabase Edge Function URLs from runtime env when configured', () => {
    const url = edgeFunctionUrl('lead-intake', { source: 'test' });
    if (!url) {
      expect(url).toBeUndefined();
      return;
    }
    expect(url).toContain('/functions/v1/lead-intake');
    expect(url).toContain('source=test');
  });
});
