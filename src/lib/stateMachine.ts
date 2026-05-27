import { canRolePerform } from './rbac';
import { nextRequiredAction } from './stageGates';
import { qualificationSections } from './coreOps';
import { evaluateSolarDispatchGate } from './solarDispatch';
import type { Deal, QualificationProgressItem, Role, StageGateAction, StageGateViewModel } from '../types';

function titleize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function action(input: StageGateAction): StageGateAction {
  return input;
}

export function buildQualificationProgress(deal: Deal): QualificationProgressItem[] {
  const missing = new Set(deal.qualification.missingSections);
  const hasOverride = Boolean(deal.qualification.overrideNote);

  return qualificationSections.map((section) => {
    const complete = !missing.has(section.id);
    const overridden = hasOverride && section.required && section.id === 'docs';
    const state = overridden
      ? 'overridden'
      : complete
        ? 'complete'
        : section.required
          ? 'blocked'
          : 'missing';
    const badge = overridden
      ? 'Override logged'
      : complete
        ? 'Complete'
        : section.required
          ? 'Required'
          : 'Optional';
    const directive = complete
      ? `${section.label} is complete.`
      : `Complete ${section.label} before qualification can close.`;

    return {
      sectionId: section.id,
      label: section.label,
      required: section.required,
      complete,
      state,
      badge,
      directive,
    };
  });
}

export function buildStageGateViewModel(deal: Deal, role: Role): StageGateViewModel {
  const viewSurvey = action({
    id: 'view_survey',
    label: deal.surveyJob ? 'Open installer survey' : 'Survey not assigned',
    enabled: Boolean(deal.surveyJob),
    reason: deal.surveyJob ? 'Installer survey workspace is available.' : 'Assign the installer survey first.',
    targetPath: deal.surveyJob ? `/surveys/${deal.surveyJob.id}` : undefined,
  });

  if (deal.stage === 'captured') {
    const qualified = deal.qualification.status === 'qualified';
    return {
      stage: deal.stage,
      headline: qualified ? 'Ready for pre-audit' : 'Complete qualification requirements',
      primaryAction: action({
        id: qualified ? 'run_pre_audit' : 'complete_qualification',
        label: qualified ? 'Run pre-audit' : 'Complete qualification',
        enabled: qualified ? canRolePerform(role, 'run_pre_audit') : canRolePerform(role, 'qualify_lead'),
        reason: qualified ? 'Qualification is ready for sizing and fit score.' : 'Required qualification sections still need work.',
      }),
      secondaryActions: [],
    };
  }

  if (deal.stage === 'pre_audit_done') {
    const solarGate = evaluateSolarDispatchGate(deal, role);
    return {
      stage: deal.stage,
      headline: solarGate.allowed ? 'Installer handoff is the next stage gate' : 'Solar roof review required before site visit',
      primaryAction: action({
        id: 'assign_survey',
        label: solarGate.allowed ? 'Assign and schedule installer survey' : 'Resolve Solar API review',
        enabled: canRolePerform(role, 'assign_survey') && !deal.surveyJob && solarGate.allowed,
        reason: deal.surveyJob ? 'Survey has already been assigned.' : solarGate.reason,
      }),
      secondaryActions: [
        action({
          id: 'rerun_pre_audit',
          label: 'Re-run audit',
          enabled: canRolePerform(role, 'run_pre_audit'),
          reason: 'Use only if bill, roof, or pricing assumptions changed.',
        }),
        action({
          id: deal.dealRoom ? 'open_deal_room' : 'generate_deal_room',
          label: deal.dealRoom ? 'Open Client Portal' : 'Generate Client Portal',
          enabled: ['owner', 'sales'].includes(role),
          reason: deal.dealRoom ? 'Client portal is already available.' : 'Create a client-facing portal link.',
          targetPath: deal.dealRoom ? `/portal/${deal.dealRoom.token}` : undefined,
        }),
      ],
    };
  }

  if (deal.stage === 'survey_assigned') {
    return {
      stage: deal.stage,
      headline: 'Waiting on installer evidence and validation',
      primaryAction: viewSurvey,
      secondaryActions: [
        action({
          id: deal.dealRoom ? 'open_deal_room' : 'generate_deal_room',
          label: deal.dealRoom ? 'Open Client Portal' : 'Generate Client Portal',
          enabled: ['owner', 'sales'].includes(role),
          reason: deal.dealRoom ? 'Client portal is already available.' : 'Share readiness status while survey is pending.',
          targetPath: deal.dealRoom ? `/portal/${deal.dealRoom.token}` : undefined,
        }),
      ],
    };
  }

  if (deal.stage === 'survey_completed') {
    return {
      stage: deal.stage,
      headline: 'Proposal and net-metering preflight',
      primaryAction: action({
        id: 'open_checkout',
        label: 'Open proposal preflight',
        enabled: canRolePerform(role, 'manage_checkout'),
        reason: 'Survey is complete; build the estimate once preflight clears.',
        targetPath: `/proposals/${deal.id}`,
      }),
      secondaryActions: [viewSurvey],
    };
  }

  if (deal.stage === 'proposal_ready') {
    return {
      stage: deal.stage,
      headline: 'Contract and acceptance are next',
      primaryAction: action({
        id: 'open_checkout',
        label: 'Open proposal and contract',
        enabled: canRolePerform(role, 'manage_checkout'),
        reason: 'Proposal snapshot and contract link are ready.',
        targetPath: `/proposals/${deal.id}`,
      }),
      secondaryActions: [viewSurvey],
    };
  }

  return {
    stage: deal.stage,
    headline: nextRequiredAction(deal),
    primaryAction: action({
      id: 'view_status',
      label: 'Review current stage',
      enabled: true,
      reason: nextRequiredAction(deal),
    }),
    secondaryActions: [],
  };
}
