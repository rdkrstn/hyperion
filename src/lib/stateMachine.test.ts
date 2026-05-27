import { describe, expect, it } from 'vitest';
import { seedDeals } from '../data/seed';
import { buildQualificationProgress, buildStageGateViewModel } from './stateMachine';

describe('state machine UI models', () => {
  it('derives qualification progress without exposing toggle-style state', () => {
    const deal = {
      ...seedDeals[0],
      qualification: {
        ...seedDeals[0].qualification,
        missingSections: ['site_control' as const, 'docs' as const],
        overrideNote: undefined,
      },
    };

    const progress = buildQualificationProgress(deal);
    const siteControl = progress.find((item) => item.sectionId === 'site_control');
    const billEnergy = progress.find((item) => item.sectionId === 'bill_energy');

    expect(progress.every((item) => typeof item.complete === 'boolean')).toBe(true);
    expect(billEnergy?.state).toBe('complete');
    expect(siteControl?.state).toBe('blocked');
    expect(siteControl?.badge).toBe('Required');
    expect(siteControl?.directive).toContain('Complete Site control');
  });

  it('turns an override into a visible warning state', () => {
    const deal = {
      ...seedDeals[0],
      qualification: {
        ...seedDeals[0].qualification,
        missingSections: [],
        overrideNote: 'Owner confirmed documents by phone.',
      },
    };

    const progress = buildQualificationProgress(deal);

    expect(progress.some((item) => item.state === 'overridden')).toBe(true);
    expect(progress.find((item) => item.sectionId === 'docs')?.badge).toBe('Override logged');
  });

  it('exposes one primary stage action for the current gate', () => {
    const preAuditDone = {
      ...seedDeals[0],
      stage: 'pre_audit_done' as const,
      surveyJob: undefined,
    };
    const surveyAssigned = {
      ...seedDeals[1],
      stage: 'survey_assigned' as const,
    };

    expect(buildStageGateViewModel(preAuditDone, 'sales').primaryAction.id).toBe('assign_survey');
    expect(buildStageGateViewModel(preAuditDone, 'sales').secondaryActions.map((action) => action.id)).toContain('rerun_pre_audit');
    expect(buildStageGateViewModel(surveyAssigned, 'sales').primaryAction.id).toBe('view_survey');
  });
});
