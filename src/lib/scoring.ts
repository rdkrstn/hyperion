import type { FinancingLane, LeadInput, LeadScore, PreAuditSnapshot, ScoreBreakdownItem } from '../types';

const targetTypes = [
  'Restaurant / Cafe',
  'Hotel / Accommodation',
  'Clinic / Lab',
  'Water Station',
  'Laundry',
  'Factory / Warehouse',
  'School / Office',
  'Retail / Grocery',
];

export function roundHalf(value: number) {
  return Math.max(1.5, Math.round(value * 2) / 2);
}

export function pmt(principal: number, annualRate: number, years: number) {
  const monthlyRate = annualRate / 12;
  const months = years * 12;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

export function calculatePreAudit(input: LeadInput): PreAuditSnapshot {
  const monthlyKwh = input.averageMonthlyBill / input.tariff;
  const targetOffset = input.averageMonthlyBill >= 50000 ? 0.65 : input.averageMonthlyBill >= 20000 ? 0.6 : 0.5;
  const sizeKwp = roundHalf((monthlyKwh * targetOffset) / input.productionPerKwp);
  const monthlyProduction = sizeKwp * input.productionPerKwp;
  const projectedSavings = Math.round(Math.min(input.averageMonthlyBill * 0.75, monthlyProduction * input.tariff * 0.85));
  const capex = Math.round(sizeKwp * input.pricePerKwp);
  const paybackYears = projectedSavings > 0 ? capex / projectedSavings / 12 : 0;
  const rtoDownpayment = Math.round(capex * 0.2);
  const rtoMonthly = Math.round(((capex - rtoDownpayment) * 1.12) / 48);
  const bankDownpayment = Math.round(capex * 0.1);
  const bankMonthly = Math.round(pmt(capex - bankDownpayment, 0.1, 5));

  return {
    monthlyKwh,
    targetOffset,
    sizeKwp,
    monthlyProduction,
    projectedSavings,
    capex,
    paybackYears,
    rtoDownpayment,
    rtoMonthly,
    bankDownpayment,
    bankMonthly,
  };
}

function laneFor(score: number, bill: number): FinancingLane {
  if (score >= 80) return 'partner_loan';
  if (score >= 60) return 'rent_to_own';
  if (bill >= 10000) return 'starter';
  return 'nurture';
}

export function laneLabel(lane: FinancingLane) {
  const labels: Record<FinancingLane, string> = {
    cash: 'Cash',
    rent_to_own: 'Rent-to-own',
    partner_loan: 'Partner loan',
    starter: 'Starter system',
    nurture: 'Nurture',
  };
  return labels[lane];
}

export function scoreLead(input: LeadInput): LeadScore {
  const breakdown: ScoreBreakdownItem[] = [];
  let score = 0;

  const billScore = input.averageMonthlyBill >= 50000 ? 20 : input.averageMonthlyBill >= 20000 ? 16 : input.averageMonthlyBill >= 10000 ? 10 : 4;
  score += billScore;
  breakdown.push({ label: 'Bill strength', points: billScore, note: input.averageMonthlyBill >= 20000 ? 'Strong operating-cost pain' : 'Lower urgency' });

  const ownershipScore = input.propertyControl === 'Owns property' ? 20 : input.propertyControl.includes('authorization') ? 12 : 2;
  score += ownershipScore;
  breakdown.push({ label: 'Property control', points: ownershipScore, note: input.propertyControl });

  const yearsScore = input.yearsInBusiness === '5+ years' ? 15 : input.yearsInBusiness === '2-5 years' ? 10 : 5;
  score += yearsScore;
  breakdown.push({ label: 'Business stability', points: yearsScore, note: input.yearsInBusiness });

  const paymentScore = input.paymentBehavior.includes('Consistent') ? 15 : input.paymentBehavior.includes('Occasional') ? 8 : 3;
  score += paymentScore;
  breakdown.push({ label: 'Payment behavior', points: paymentScore, note: input.paymentBehavior });

  const revenueScore = input.revenueBand.includes('500k+') ? 10 : input.revenueBand.includes('150k') ? 8 : input.revenueBand.includes('Below') ? 4 : 3;
  score += revenueScore;
  breakdown.push({ label: 'Revenue band', points: revenueScore, note: input.revenueBand });

  const timelineScore = input.purchaseTimeline === '0-30 days' ? 10 : input.purchaseTimeline === '1-3 months' ? 7 : input.purchaseTimeline === '3-6 months' ? 4 : 1;
  score += timelineScore;
  breakdown.push({ label: 'Timeline urgency', points: timelineScore, note: input.purchaseTimeline });

  const typeScore = targetTypes.includes(input.businessType) ? 5 : input.businessType === 'Residential only' ? 0 : 2;
  score += typeScore;
  breakdown.push({ label: 'Business fit', points: typeScore, note: input.businessType });

  const interestScore = input.interestLevel === 'Ready for site survey' ? 10 : input.interestLevel === 'Wants quote first' ? 5 : 1;
  score += interestScore;
  breakdown.push({ label: 'Interest signal', points: interestScore, note: input.interestLevel });

  const cappedScore = Math.max(0, Math.min(100, score));
  const lane = laneFor(cappedScore, input.averageMonthlyBill);

  return {
    score: cappedScore,
    lane,
    priority: cappedScore >= 60 && input.averageMonthlyBill >= 15000,
    breakdown,
  };
}
