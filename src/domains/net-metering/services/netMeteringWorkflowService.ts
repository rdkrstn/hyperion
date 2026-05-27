import type { DealRecord } from '../../deals/types';
import { proposalDocumentGate } from '../../documents/services/documentService';
import type { DocumentRecord } from '../../documents/types';
import type { SurveyRecord } from '../../surveys/types';
import type { NetMeteringWorkflowStepView, NetMeteringWorkflowView } from '../types';

export interface NetMeteringWorkflowInput {
  deal: DealRecord;
  documents: DocumentRecord[];
  surveys: SurveyRecord[];
  utilityProvider?: string;
  electricalPermitSubmittedAt?: string;
  cfeiSubmittedAt?: string;
}

function step(input: NetMeteringWorkflowStepView): NetMeteringWorkflowStepView {
  return input;
}

function workingDaysSince(date?: string, now = new Date()) {
  if (!date) return 0;
  const start = new Date(date);
  if (Number.isNaN(start.getTime())) return 0;
  let count = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  while (cursor < end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function buildNetMeteringWorkflowView(input: NetMeteringWorkflowInput): NetMeteringWorkflowView {
  const gate = proposalDocumentGate({
    documents: input.documents,
    dealId: input.deal.id,
    leadId: input.deal.leadId,
  });
  const eligibleBlockers = [
    input.utilityProvider ? undefined : 'Utility provider is required.',
    input.deal.leadSnapshot.siteControl === 'unknown' ? 'Site-control answer is required.' : undefined,
  ].filter((item): item is string => Boolean(item));
  const validatedSurvey = input.surveys.find((survey) => survey.dealId === input.deal.id && survey.validationOutcome === 'validated');
  const documentsBlockers = gate.requirements
    .filter((requirement) => !requirement.passed)
    .map((requirement) => requirement.blockingReason ?? `${requirement.label} must be uploaded and validated.`);
  const technicalBlockers = validatedSurvey ? [] : ['Installer survey must be validated.'];

  const electricalWorkingDays = workingDaysSince(input.electricalPermitSubmittedAt);
  const cfeiWorkingDays = workingDaysSince(input.cfeiSubmittedAt);
  const applicationSla = electricalWorkingDays >= 3 ? 'DEEMED APPROVED (RA 11032)' : undefined;
  const meteringSla = cfeiWorkingDays >= 7 ? 'DEEMED APPROVED (RA 11032)' : undefined;

  const steps = [
    step({
      id: 'eligibility',
      title: 'Eligibility',
      customerLabel: eligibleBlockers.length ? 'Needs review' : 'Likely eligible / needs utility review',
      staffLabel: `Utility: ${input.utilityProvider || 'missing'}; site control: ${input.deal.leadSnapshot.siteControl}`,
      status: eligibleBlockers.length ? 'blocked' : 'complete',
      blockers: eligibleBlockers,
      nextAction: eligibleBlockers[0],
    }),
    step({
      id: 'documents',
      title: 'Documents',
      customerLabel: documentsBlockers.length ? 'Document checklist incomplete' : 'Required documents validated',
      staffLabel: gate.allowed ? 'Customer Bill, Valid ID, and Site-Control Document are validated.' : gate.reason,
      status: documentsBlockers.length ? 'blocked' : 'complete',
      blockers: documentsBlockers,
      nextAction: documentsBlockers[0],
    }),
    step({
      id: 'technical_review',
      title: 'Technical Review',
      customerLabel: technicalBlockers.length ? 'Installer survey needed' : 'Installer validation complete',
      staffLabel: technicalBlockers.length ? 'Validated installer survey is required before proposal.' : `Validated survey: ${validatedSurvey?.id}`,
      status: technicalBlockers.length ? 'blocked' : 'complete',
      blockers: technicalBlockers,
      nextAction: technicalBlockers[0],
    }),
    step({
      id: 'application',
      title: 'Application',
      customerLabel: applicationSla ? 'Prepared for submission' : 'Application preparation',
      staffLabel: input.electricalPermitSubmittedAt ? `${electricalWorkingDays} working days since electrical permit submission.` : 'Electrical permit submission date not recorded.',
      status: input.electricalPermitSubmittedAt ? 'in_progress' : 'missing',
      blockers: [],
      slaBadge: applicationSla,
      nextAction: input.electricalPermitSubmittedAt ? 'Track DU/LGU response.' : 'Record electrical permit submission date.',
    }),
    step({
      id: 'metering',
      title: 'Metering',
      customerLabel: meteringSla ? 'Bi-directional meter pending' : 'Metering coordination',
      staffLabel: input.cfeiSubmittedAt ? `${cfeiWorkingDays} working days since CFEI submission.` : 'CFEI submission date not recorded.',
      status: input.cfeiSubmittedAt ? 'in_progress' : 'missing',
      blockers: [],
      slaBadge: meteringSla,
      nextAction: input.cfeiSubmittedAt ? 'Follow up bi-directional meter timeline.' : 'Record CFEI submission date.',
    }),
    step({
      id: 'active_credits',
      title: 'Active Credits',
      customerLabel: 'Track exported energy credits',
      staffLabel: 'Credit monitoring starts after installation and meter activation.',
      status: input.deal.status === 'won' ? 'in_progress' : 'missing',
      blockers: [],
      nextAction: 'Activate monitoring after turnover.',
    }),
  ] satisfies NetMeteringWorkflowStepView[];

  const readyForProposal = steps.slice(0, 3).every((item) => item.status === 'complete');
  const nextAction = readyForProposal
    ? 'Net-metering gates are ready for proposal.'
    : steps.find((item) => item.blockers.length)?.nextAction ?? 'Review net-metering workflow.';

  return { readyForProposal, nextAction, steps };
}
