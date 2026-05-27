import type { Deal, FinancingLane, LeadSource, LeadStage } from '../types';

const stages: LeadStage[] = ['captured', 'pre_audit_done', 'survey_assigned', 'survey_completed', 'proposal_ready', 'cs_review', 'owner_review', 'approved', 'nurture'];

export function computeAnalytics(deals: Deal[]) {
  const activeDeals = deals.filter((deal) => deal.archiveState !== 'archived');
  const stageCounts = stages.map((stage) => ({
    stage,
    count: activeDeals.filter((deal) => deal.stage === stage).length,
  }));

  const sourceCounts = activeDeals.reduce<Record<LeadSource, number>>((acc, deal) => {
    acc[deal.lead.source] = (acc[deal.lead.source] || 0) + 1;
    return acc;
  }, {} as Record<LeadSource, number>);

  const laneCounts = activeDeals.reduce<Record<FinancingLane, number>>((acc, deal) => {
    const lane = deal.score?.lane ?? 'nurture';
    acc[lane] = (acc[lane] || 0) + 1;
    return acc;
  }, {} as Record<FinancingLane, number>);

  const qualified = activeDeals.filter((deal) => deal.score?.priority).length;
  const signed = activeDeals.filter((deal) => deal.stage === 'approved').length;

  return {
    total: activeDeals.length,
    qualified,
    signed,
    stageCounts,
    sourceCounts,
    laneCounts,
    conversionRate: activeDeals.length ? Math.round((signed / activeDeals.length) * 100) : 0,
  };
}
