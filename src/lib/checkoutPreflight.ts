import { requiredSurveyUploadCategories } from './coreOps';
import { evaluateComplianceGate, evaluateSolarApiGate } from './compliance';
import { evaluateNetMeteringGate } from './netMetering';
import { isInstallerSurveyValidated } from './stageGates';
import type { CheckoutPreflight, Deal } from '../types';

export function evaluateCheckoutPreflight(deal: Deal): CheckoutPreflight {
  const uploaded = new Set(deal.surveyUploads.map((upload) => upload.category));
  const missingUploads = requiredSurveyUploadCategories.filter((category) => !uploaded.has(category));
  const netMeteringGate = evaluateNetMeteringGate(deal);
  const solarGate = evaluateSolarApiGate(deal);
  const complianceGate = evaluateComplianceGate(deal);
  const checks = [
    {
      key: 'pre_audit',
      label: 'Pre-audit',
      passed: Boolean(deal.preAudit && deal.score),
      detail: deal.preAudit ? `${deal.preAudit.sizeKwp} kWp recommendation saved` : 'Pre-audit and scoring snapshot are required',
    },
    {
      key: 'solar_api',
      label: 'Google Solar API',
      passed: solarGate.allowed,
      detail: solarGate.reason,
    },
    {
      key: 'installer_survey',
      label: 'Installer survey',
      passed: Boolean(deal.surveyJob?.completed && isInstallerSurveyValidated(deal) && !missingUploads.length),
      detail: missingUploads.length ? `Missing evidence: ${missingUploads.join(', ')}` : 'Installer evidence and validation complete',
    },
    {
      key: 'net_metering',
      label: 'Net-metering',
      passed: netMeteringGate.allowed,
      detail: netMeteringGate.reason,
    },
    {
      key: 'compliance_docs',
      label: 'Compliance PDFs',
      passed: complianceGate.allowed,
      detail: complianceGate.reason,
    },
    {
      key: 'estimate',
      label: 'Checkout estimate',
      passed: Boolean(deal.checkoutEstimate && deal.checkoutEstimate.status === 'frozen' && deal.checkoutEstimate.approvalStatus !== 'needs_pricing_approval'),
      detail: deal.checkoutEstimate
        ? `${deal.checkoutEstimate.total.toLocaleString('en-PH')} package total / ${deal.checkoutEstimate.status.replaceAll('_', ' ')} / ${deal.checkoutEstimate.approvalStatus.replaceAll('_', ' ')}`
        : 'Build and freeze an editable formal estimate from catalog items',
    },
    {
      key: 'proposal_snapshot',
      label: 'Frozen proposal',
      passed: Boolean(deal.proposal),
      detail: deal.proposal ? deal.proposal.quoteNumber : 'Generate print-friendly proposal snapshot',
    },
  ];
  const blockers = checks.filter((check) => !check.passed).map((check) => `${check.label}: ${check.detail}`);
  const gateKeys = new Set(['pre_audit', 'solar_api', 'installer_survey', 'net_metering', 'compliance_docs']);
  const canGenerateQuote = checks.filter((check) => gateKeys.has(check.key)).every((check) => check.passed);
  const readyForContract = checks.every((check) => check.passed);

  return { blockers, checks, canGenerateQuote, readyForContract };
}
