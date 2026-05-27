import type { AppAction, Role } from '../types';

const permissions: Record<Role, AppAction[]> = {
  owner: [
    'create_lead',
    'qualify_lead',
    'run_pre_audit',
    'assign_survey',
    'manage_checkout',
    'manage_quote_request',
    'generate_proposal',
    'manage_invoice',
    'manage_billing_ledger',
    'manage_client',
    'manage_ticket',
    'manage_calendar',
    'review_analytics',
    'archive_record',
    'request_cancellation',
    'request_refund',
    'approve_refund',
    'submit_owner_review',
    'approve_owner_review',
    'view_all_dashboards',
    'approve_ai_suggestion',
  ],
  manager: ['manage_client', 'manage_ticket', 'manage_calendar', 'review_analytics', 'approve_ai_suggestion'],
  sales: ['create_lead', 'qualify_lead', 'run_pre_audit', 'assign_survey', 'manage_checkout', 'manage_quote_request', 'generate_proposal', 'manage_client', 'manage_ticket', 'manage_calendar', 'archive_record', 'request_cancellation', 'request_refund'],
  cs: ['manage_invoice', 'manage_billing_ledger', 'manage_client', 'manage_ticket', 'manage_calendar', 'request_cancellation', 'request_refund', 'submit_owner_review'],
  installer: ['complete_survey', 'upload_survey_evidence', 'manage_ticket', 'manage_calendar'],
};

export function canRolePerform(role: Role, action: AppAction) {
  return permissions[role].includes(action);
}

export function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    owner: 'Owner',
    manager: 'Manager',
    sales: 'Sales',
    cs: 'Customer Success',
    installer: 'Installer',
  };
  return labels[role];
}

export function visibleStagesForRole(role: Role) {
  if (role === 'owner' || role === 'manager') return ['captured', 'pre_audit_done', 'survey_assigned', 'survey_completed', 'proposal_ready', 'cs_review', 'owner_review', 'approved', 'nurture'];
  if (role === 'sales') return ['captured', 'pre_audit_done', 'survey_assigned', 'survey_completed', 'proposal_ready', 'nurture'];
  if (role === 'cs') return ['proposal_ready', 'cs_review', 'owner_review', 'approved'];
  return ['survey_assigned', 'survey_completed'];
}
