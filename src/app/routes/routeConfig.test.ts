import { describe, expect, it } from 'vitest';
import { appRoutes, canAccessRoute, isProtectedPath, legacyUnavailableRoutes, publicRoutes, unavailableRouteFor, visibleRoutesForRole } from './routeConfig';

describe('route config', () => {
  it('uses clean demo routes and removes legacy route handling', () => {
    expect(appRoutes.map((route) => route.path)).toContain('/deals');
    expect(appRoutes.map((route) => route.path)).toContain('/proposals');
    expect(appRoutes.map((route) => route.path)).toContain('/solar-snapshots');
    expect(appRoutes.some((route) => route.path === '/checkout')).toBe(false);
    expect(appRoutes.some((route) => route.path === '/opportunities')).toBe(false);
  });

  it('models removed routes as unavailable routes instead of protected redirects', () => {
    const legacyPaths = ['/crm', '/pipeline', '/opportunities', '/checkout', '/billing', '/reports', '/ai-assist', '/notifications', '/clients'];
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
    expect(visibleRoutesForRole('sales').map((route) => route.path)).toEqual(['/leads', '/deals', '/proposals', '/calendar', '/portal-links']);
    expect(canAccessRoute('/surveys/survey-1', 'cs')).toBe(false);
    expect(canAccessRoute('/documents', 'cs')).toBe(true);
  });
});
