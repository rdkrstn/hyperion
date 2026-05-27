import { describe, expect, it } from 'vitest';
import { canAccessRoute, isProtectedPath, routeTitle } from './routes';

describe('production route contracts', () => {
  it('protects ID detail routes and resolves titles from the collection route', () => {
    expect(isProtectedPath('/leads/lead-001')).toBe(true);
    expect(isProtectedPath('/deals/deal-001')).toBe(true);
    expect(isProtectedPath('/proposals/proposal-003')).toBe(true);
    expect(isProtectedPath('/surveys/survey-002')).toBe(true);
    expect(isProtectedPath('/solar-snapshots/solar-002')).toBe(true);
    expect(isProtectedPath('/calendar/event-001')).toBe(true);
    expect(isProtectedPath('/documents/doc-005')).toBe(true);
    expect(isProtectedPath('/portal/client-token')).toBe(false);
    expect(routeTitle('/leads/lead-001')).toBe('Leads');
    expect(routeTitle('/deals/deal-001')).toBe('Deals');
    expect(routeTitle('/proposals/proposal-003')).toBe('Proposals');
    expect(routeTitle('/solar-snapshots/solar-002')).toBe('Solar Workbench');
    expect(routeTitle('/analytics/report-001')).toBe('Analytics');
  });

  it('allows manager to review analytics without old report or owner-only actions', () => {
    expect(canAccessRoute('/analytics', 'manager')).toBe(true);
    expect(isProtectedPath('/reports')).toBe(false);
    expect(canAccessRoute('/settings', 'manager')).toBe(true);
    expect(canAccessRoute('/surveys/survey-002', 'manager')).toBe(true);
  });
});
