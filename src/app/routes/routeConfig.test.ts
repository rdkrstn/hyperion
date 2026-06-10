import { describe, expect, it } from 'vitest';
import { appRoutes, canAccessRoute, isProtectedPath, legacyUnavailableRoutes, publicRoutes, unavailableRouteFor, visibleRoutesForRole } from './routeConfig';

describe('route config', () => {
  it('uses Hyperion public demo routes and keeps domain routes available', () => {
    expect(appRoutes.map((route) => `${route.label}:${route.path}`)).toEqual(expect.arrayContaining([
      'Overview:/dashboard',
      'Pipeline:/pipeline',
      'Workbench:/workbench',
      'Automations:/automations',
      'Analytics:/analytics',
      'Docs:/docs',
    ]));
    expect(appRoutes.map((route) => route.path)).toContain('/deals');
    expect(appRoutes.map((route) => route.path)).toContain('/proposals');
    expect(appRoutes.map((route) => route.path)).toContain('/solar-snapshots');
    expect(appRoutes.some((route) => route.path === '/checkout')).toBe(false);
    expect(appRoutes.some((route) => route.path === '/opportunities')).toBe(false);
  });

  it('models removed routes as unavailable routes instead of protected redirects', () => {
    const legacyPaths = ['/crm', '/opportunities', '/checkout', '/billing', '/reports', '/ai-assist', '/notifications', '/clients'];
    expect(legacyUnavailableRoutes.map((route) => route.path)).toEqual(legacyPaths);
    for (const path of legacyPaths) {
      expect(isProtectedPath(path)).toBe(false);
      expect(unavailableRouteFor(path)?.legacy).toBe(true);
    }
    expect(unavailableRouteFor('/checkout')?.canonicalReplacement).toBe('/proposals');
  });

  it('keeps public token routes outside protected route matching', () => {
    expect(publicRoutes.map((route) => route.path)).toEqual(['/signin', '/inquiry', '/remote-intake', '/portal', '/contracts']);
    expect(isProtectedPath('/signin')).toBe(false);
    expect(isProtectedPath('/remote-intake/token-123')).toBe(false);
    expect(isProtectedPath('/portal/token-123')).toBe(false);
    expect(isProtectedPath('/contracts/token-123')).toBe(false);
  });

  it('keeps role-specific slim navigation', () => {
    expect(visibleRoutesForRole('sales').map((route) => route.label)).toEqual(['Overview', 'Pipeline', 'Workbench', 'Automations', 'Analytics', 'Docs']);
    expect(visibleRoutesForRole('owner').map((route) => route.path)).toEqual(['/dashboard', '/pipeline', '/workbench', '/automations', '/analytics', '/docs']);
    expect(canAccessRoute('/surveys/survey-1', 'cs')).toBe(false);
    expect(canAccessRoute('/documents', 'cs')).toBe(true);
    expect(canAccessRoute('/workbench', 'cs')).toBe(true);
  });
});
