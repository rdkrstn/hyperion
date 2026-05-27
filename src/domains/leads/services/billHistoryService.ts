import type { BillHistoryMonth } from '../types';

export interface AnnualizedBillHistory {
  months: BillHistoryMonth[];
  annualized: boolean;
  sourceMonthCount: number;
}

export function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

export function annualizeBillHistory(months: BillHistoryMonth[]): AnnualizedBillHistory {
  const validMonths = months
    .filter((month) => Number.isFinite(month.billAmount) && month.billAmount > 0)
    .slice(0, 12)
    .map((month) => ({
      ...month,
      source: month.source === 'annualized' ? 'annualized' as const : 'observed' as const,
    }));
  if (validMonths.length >= 12) {
    return {
      months: validMonths,
      annualized: validMonths.some((month) => month.source === 'annualized'),
      sourceMonthCount: validMonths.filter((month) => month.source === 'observed').length,
    };
  }

  const observed = validMonths.map((month) => ({ ...month, source: 'observed' as const }));
  const sourceMonthCount = observed.length;

  const averageBill = average(observed.map((month) => month.billAmount));
  const kwhValues = observed.map((month) => month.kwh).filter((value): value is number => Number.isFinite(value));
  const averageKwh = kwhValues.length ? average(kwhValues) : undefined;
  const padded: BillHistoryMonth[] = [...observed];

  while (padded.length < 12) {
    padded.push({
      periodLabel: `Annualized ${padded.length + 1}`,
      billAmount: averageBill,
      kwh: averageKwh,
      source: 'annualized',
    });
  }

  return { months: padded, annualized: sourceMonthCount > 0 && sourceMonthCount < 12, sourceMonthCount };
}

export function summarizeBillHistory(months: BillHistoryMonth[]) {
  const normalized = months.slice(0, 12);
  const averageMonthlyBill = average(normalized.map((month) => month.billAmount));
  const kwhValues = normalized.map((month) => month.kwh).filter((value): value is number => Number.isFinite(value));
  const averageMonthlyKwh = kwhValues.length ? average(kwhValues) : undefined;
  return {
    averageMonthlyBill,
    averageMonthlyKwh,
    annualBill: averageMonthlyBill * 12,
    annualKwh: averageMonthlyKwh ? averageMonthlyKwh * 12 : undefined,
  };
}
