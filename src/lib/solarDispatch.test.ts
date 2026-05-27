import { describe, expect, it } from 'vitest';
import { seedDeals } from '../data/seed';
import {
  approveSolarDispatchOverride,
  assignAndScheduleSurveyJob,
  evaluateSolarDispatchGate,
  requestSolarDispatchOverride,
} from './solarDispatch';

describe('solar dispatch gate', () => {
  const base = {
    ...seedDeals[1],
    stage: 'pre_audit_done' as const,
    solarInsights: { ...seedDeals[1].solarInsights!, status: 'maps_pending' as const, ownerOverrideAt: undefined },
  };

  it('blocks sales from assigning a survey before Solar API verification or approved override', () => {
    const gate = evaluateSolarDispatchGate(base, 'sales');

    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain('Solar API');
  });

  it('allows owner or manager approved manual dispatch when Solar API cannot verify the roof', () => {
    const requested = requestSolarDispatchOverride(base, 'sales', 'Google imagery is unavailable but customer has a confirmed pin.');
    const approved = approveSolarDispatchOverride(requested, 'manager', 'Manager approved manual dispatch after pin review.');
    const gate = evaluateSolarDispatchGate(approved, 'sales');

    expect(gate.allowed).toBe(true);
    expect(approved.solarInsights?.ownerOverrideReason).toContain('Manager approved');
  });

  it('requires installer and calendar slot when assigning survey', () => {
    const ready = { ...base, solarInsights: { ...base.solarInsights!, status: 'ready' as const, maxSystemSizeKwp: 12, imageryQuality: 'HIGH' as const } };

    expect(() => assignAndScheduleSurveyJob(ready, 'sales', {
      assignedInstaller: '',
      scheduledAt: '2026-05-25T10:00',
      location: 'Makati',
    })).toThrow(/installer/i);

    const scheduled = assignAndScheduleSurveyJob(ready, 'sales', {
      assignedInstaller: 'Installer One',
      scheduledAt: '2026-05-25T10:00',
      location: 'Makati',
    });

    expect(scheduled.deal.stage).toBe('survey_assigned');
    expect(scheduled.calendarEvent.type).toBe('survey');
  });
});
