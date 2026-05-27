import { canCreateDealFromLead } from './leadService';
import type { LeadRecord } from '../types';

export function buildLeadDetailModel(lead: LeadRecord) {
  const createGate = canCreateDealFromLead(lead);
  return {
    lead,
    readinessScore: lead.readinessScore,
    readinessLabel: `${lead.readinessScore}/100`,
    readinessTone: lead.readinessScore >= 75 ? 'success' : lead.readinessScore >= 55 ? 'warning' : 'error',
    estimatedSavingsRange: lead.estimatedSavingsRange,
    nextAction: lead.nextAction,
    createGate,
  } as const;
}
