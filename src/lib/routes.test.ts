import { describe, expect, it } from 'vitest';
import { canAccessRoute, defaultProtectedPath, isProtectedPath, routeTitle, visibleRoutesForRole } from './routes';

describe('dashboard routes', () => {
  it('protects dashboard routes and keeps signin public', () => {
    expect(defaultProtectedPath).toBe('/dashboard');
    expect(isProtectedPath('/dashboard')).toBe(true);
    expect(isProtectedPath('/leads')).toBe(true);
    expect(isProtectedPath('/leads/new')).toBe(true);
    expect(isProtectedPath('/deals')).toBe(true);
    expect(isProtectedPath('/deals/deal-001')).toBe(true);
    expect(isProtectedPath('/documents')).toBe(true);
    expect(isProtectedPath('/proposals')).toBe(true);
    expect(isProtectedPath('/proposals/proposal-001')).toBe(true);
    expect(isProtectedPath('/profile')).toBe(true);
    expect(isProtectedPath('/signin')).toBe(false);
    expect(isProtectedPath('/contracts/demo-token')).toBe(false);
    expect(isProtectedPath('/portal/demo-token')).toBe(false);
    expect(isProtectedPath('/remote-intake/demo-token')).toBe(false);
  });

  it('removes crowded legacy demo routes from active protected routing', () => {
    for (const route of ['/crm', '/pipeline', '/opportunities', '/checkout', '/billing', '/reports', '/ai-assist', '/notifications', '/clients']) {
      expect(isProtectedPath(route)).toBe(false);
    }
  });

  it('limits admin routes to owner and labels routes', () => {
    expect(canAccessRoute('/staff', 'owner')).toBe(true);
    expect(canAccessRoute('/staff', 'sales')).toBe(false);
    expect(canAccessRoute('/proposals', 'sales')).toBe(true);
    expect(canAccessRoute('/proposals', 'cs')).toBe(false);
    expect(canAccessRoute('/surveys', 'cs')).toBe(false);
    expect(canAccessRoute('/surveys/survey-123', 'cs')).toBe(false);
    expect(canAccessRoute('/documents', 'cs')).toBe(true);
    expect(canAccessRoute('/profile', 'cs')).toBe(true);
    expect(routeTitle('/deals/deal-001')).toBe('Deals');
    expect(routeTitle('/proposals/proposal-001')).toBe('Proposals');
    expect(routeTitle('/documents')).toBe('Documents');
  });

  it('returns slim role-specific demo navigation', () => {
    expect(visibleRoutesForRole('owner').map((route) => route.label)).toEqual([
      'Dashboard',
      'Leads',
      'Deals',
      'Surveys',
      'Documents',
      'Proposals',
      'Tickets',
      'Analytics',
      'Settings',
    ]);
    expect(visibleRoutesForRole('sales').map((route) => route.label)).toEqual([
      'Leads',
      'Deals',
      'Proposals',
      'Calendar',
      'Client Portal Links',
    ]);
    expect(visibleRoutesForRole('installer').map((route) => route.label)).toEqual([
      'Assigned Surveys',
      'Site Details',
      'Evidence Upload',
      'Blockers',
      'Completed Surveys',
    ]);
  });
});
