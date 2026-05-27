import { Navigate, useLocation } from 'react-router-dom';
import { useSolarOps } from '../../shared/api/SolarOpsProvider';
import { canAccessRoute } from '../routes/routeConfig';
import type { ReactElement } from 'react';

export function RequireRouteAccess({ children }: { children: ReactElement }) {
  const { activeRole } = useSolarOps();
  const location = useLocation();
  if (!canAccessRoute(location.pathname, activeRole)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
