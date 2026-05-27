import type { Deal } from '../types';

export function checkoutEligibleDeals(deals: Deal[]) {
  return deals.filter((deal) => deal.stage === 'survey_completed' || deal.stage === 'proposal_ready' || Boolean(deal.checkoutEstimate));
}

export function selectCheckoutDeal(input: {
  deals: Deal[];
  selectedDealId?: string;
  routedDealId?: string;
}) {
  const eligibleDeals = checkoutEligibleDeals(input.deals);
  return input.deals.find((deal) => deal.id === input.routedDealId)
    ?? eligibleDeals.find((deal) => deal.id === input.selectedDealId)
    ?? eligibleDeals[0];
}
