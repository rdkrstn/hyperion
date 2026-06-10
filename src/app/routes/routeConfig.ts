import type { Role } from '../../shared/types/app';

export interface AppRoute {
  path: string;
  label: string;
  section: 'workspace' | 'operations' | 'admin';
  roles: Role[];
  visible?: boolean;
  public?: boolean;
  legacy?: boolean;
  unavailableReason?: string;
  canonicalReplacement?: string;
}

export interface VisibleRoute {
  path: string;
  label: string;
  section: AppRoute['section'];
}

const allStaffRoles: Role[] = ['owner', 'manager', 'sales', 'cs', 'installer'];
const ownerManager: Role[] = ['owner', 'manager'];
const salesLeadership: Role[] = ['owner', 'manager', 'sales'];
const primaryDemoRoles: Role[] = ['owner', 'manager', 'sales', 'cs', 'installer'];

export const defaultProtectedPath = '/dashboard';

export const appRoutes: AppRoute[] = [
  { path: '/dashboard', label: 'Overview', section: 'workspace', roles: primaryDemoRoles },
  { path: '/pipeline', label: 'Pipeline', section: 'workspace', roles: primaryDemoRoles },
  { path: '/workbench', label: 'Workbench', section: 'workspace', roles: primaryDemoRoles },
  { path: '/automations', label: 'Automations', section: 'operations', roles: primaryDemoRoles },
  { path: '/analytics', label: 'Analytics', section: 'workspace', roles: primaryDemoRoles },
  { path: '/docs', label: 'Docs', section: 'admin', roles: primaryDemoRoles },
  { path: '/leads', label: 'Leads', section: 'workspace', roles: salesLeadership, visible: false },
  { path: '/deals', label: 'Deals', section: 'workspace', roles: salesLeadership, visible: false },
  { path: '/surveys', label: 'Surveys', section: 'operations', roles: ['owner', 'manager', 'sales', 'installer'], visible: false },
  { path: '/documents', label: 'Documents', section: 'operations', roles: ['owner', 'manager', 'cs'], visible: false },
  { path: '/proposals', label: 'Proposals', section: 'workspace', roles: salesLeadership, visible: false },
  { path: '/solar-snapshots', label: 'Solar Workbench', section: 'workspace', roles: ['owner', 'manager', 'sales', 'installer'], visible: false },
  { path: '/calendar', label: 'Calendar', section: 'operations', roles: ['sales'], visible: false },
  { path: '/portal-links', label: 'Client Portal Links', section: 'workspace', roles: ['sales'], visible: false },
  { path: '/tickets', label: 'Tickets', section: 'operations', roles: ['owner', 'manager', 'cs'], visible: false },
  { path: '/settings', label: 'Settings', section: 'admin', roles: ownerManager, visible: false },
  { path: '/profile', label: 'Profile', section: 'admin', roles: allStaffRoles, visible: false },
  { path: '/staff', label: 'Staff', section: 'admin', roles: ['owner'], visible: false },
];

export const publicRoutes: AppRoute[] = [
  { path: '/signin', label: 'Sign in', section: 'workspace', roles: allStaffRoles, public: true, visible: false },
  { path: '/inquiry', label: 'Public inquiry', section: 'workspace', roles: allStaffRoles, public: true, visible: false },
  { path: '/remote-intake', label: 'Remote intake', section: 'workspace', roles: allStaffRoles, public: true, visible: false },
  { path: '/portal', label: 'Client Portal', section: 'workspace', roles: allStaffRoles, public: true, visible: false },
  { path: '/contracts', label: 'Contract signing', section: 'workspace', roles: allStaffRoles, public: true, visible: false },
];

export const legacyUnavailableRoutes: AppRoute[] = [
  { path: '/crm', label: 'CRM', section: 'workspace', roles: allStaffRoles, legacy: true, unavailableReason: 'CRM was split into Leads and Deals.', canonicalReplacement: '/leads' },
  { path: '/opportunities', label: 'Opportunities', section: 'workspace', roles: allStaffRoles, legacy: true, unavailableReason: 'Opportunities were renamed to Deals.', canonicalReplacement: '/deals' },
  { path: '/checkout', label: 'Checkout', section: 'workspace', roles: allStaffRoles, legacy: true, unavailableReason: 'Checkout was replaced by the Proposal Builder.', canonicalReplacement: '/proposals' },
  { path: '/billing', label: 'Billing', section: 'operations', roles: allStaffRoles, legacy: true, unavailableReason: 'Billing is hidden from the demo; provider execution remains mocked.', canonicalReplacement: '/proposals' },
  { path: '/reports', label: 'Reports', section: 'workspace', roles: allStaffRoles, legacy: true, unavailableReason: 'Reports are consolidated into owner analytics.', canonicalReplacement: '/analytics' },
  { path: '/ai-assist', label: 'AI Assist', section: 'workspace', roles: allStaffRoles, legacy: true, unavailableReason: 'AI is hidden from the demo and limited to future owner/manager summaries.', canonicalReplacement: '/analytics' },
  { path: '/notifications', label: 'Notifications', section: 'operations', roles: allStaffRoles, legacy: true, unavailableReason: 'Notifications are not a primary demo module.', canonicalReplacement: '/dashboard' },
  { path: '/clients', label: 'Clients', section: 'workspace', roles: allStaffRoles, legacy: true, unavailableReason: 'Clients are post-acceptance support records, not a primary sales module.', canonicalReplacement: '/portal-links' },
];

export const visibleNavigation: Record<Role, VisibleRoute[]> = {
  owner: appRoutes.filter((route) => route.visible !== false).map(({ path, label, section }) => ({ path, label, section })),
  manager: appRoutes.filter((route) => route.visible !== false).map(({ path, label, section }) => ({ path, label, section })),
  sales: appRoutes.filter((route) => route.visible !== false).map(({ path, label, section }) => ({ path, label, section })),
  installer: appRoutes.filter((route) => route.visible !== false).map(({ path, label, section }) => ({ path, label, section })),
  cs: appRoutes.filter((route) => route.visible !== false).map(({ path, label, section }) => ({ path, label, section })),
  client: [],
};

function cleanPath(pathname: string) {
  return pathname.split(/[?#]/)[0] || '/';
}

function routeFor(pathname: string) {
  const path = cleanPath(pathname);
  return appRoutes.find((route) => path === route.path || path.startsWith(`${route.path}/`));
}

export function unavailableRouteFor(pathname: string) {
  const path = cleanPath(pathname);
  return legacyUnavailableRoutes.find((route) => route.path === path || path.startsWith(`${route.path}/`));
}

export function visibleRoutesForRole(role: Role) {
  return visibleNavigation[role];
}

export function isProtectedPath(pathname: string) {
  return Boolean(routeFor(pathname));
}

export function canAccessRoute(pathname: string, role: Role) {
  const route = routeFor(pathname);
  return route ? route.roles.includes(role) : true;
}

export function routeTitle(pathname: string) {
  return routeFor(pathname)?.label ?? unavailableRouteFor(pathname)?.label ?? 'Page unavailable';
}
