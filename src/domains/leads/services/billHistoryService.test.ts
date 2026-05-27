import { describe, expect, it } from 'vitest';
import { annualizeBillHistory, summarizeBillHistory } from './billHistoryService';
import type { BillHistoryMonth } from '../types';

describe('bill history service', () => {
  it('keeps a 12-month observed bill history unchanged', () => {
    const observed: BillHistoryMonth[] = Array.from({ length: 12 }, (_, index) => ({
      periodLabel: `2026-${String(index + 1).padStart(2, '0')}`,
      billAmount: 10000 + index * 100,
      kwh: 800 + index * 10,
      source: 'observed',
    }));

    const result = annualizeBillHistory(observed);

    expect(result.months).toHaveLength(12);
    expect(result.annualized).toBe(false);
    expect(result.sourceMonthCount).toBe(12);
    expect(result.months.every((month) => month.source === 'observed')).toBe(true);
  });

  it('annualizes 3-6 observed months into a 12-month graph using averages', () => {
    const result = annualizeBillHistory([
      { periodLabel: '2026-01', billAmount: 9000, kwh: 700, source: 'observed' },
      { periodLabel: '2026-02', billAmount: 12000, kwh: 1000, source: 'observed' },
      { periodLabel: '2026-03', billAmount: 15000, kwh: 1300, source: 'observed' },
    ]);

    expect(result.months).toHaveLength(12);
    expect(result.annualized).toBe(true);
    expect(result.sourceMonthCount).toBe(3);
    expect(result.months.slice(0, 3).every((month) => month.source === 'observed')).toBe(true);
    expect(result.months.slice(3).every((month) => month.source === 'annualized')).toBe(true);
    expect(result.months[3]).toMatchObject({ billAmount: 12000, kwh: 1000 });
  });

  it('preserves annualized labels when a stored 12-month mixed series is rendered again', () => {
    const mixed = annualizeBillHistory([
      { periodLabel: '2026-01', billAmount: 9000, kwh: 700, source: 'observed' },
      { periodLabel: '2026-02', billAmount: 12000, kwh: 1000, source: 'observed' },
      { periodLabel: '2026-03', billAmount: 15000, kwh: 1300, source: 'observed' },
    ]);

    const result = annualizeBillHistory(mixed.months);

    expect(result.months).toHaveLength(12);
    expect(result.annualized).toBe(true);
    expect(result.sourceMonthCount).toBe(3);
    expect(result.months.slice(0, 3).every((month) => month.source === 'observed')).toBe(true);
    expect(result.months.slice(3).every((month) => month.source === 'annualized')).toBe(true);
  });

  it('summarizes annualized monthly bill and kWh averages', () => {
    const result = annualizeBillHistory([
      { periodLabel: '2026-01', billAmount: 9000, kwh: 700, source: 'observed' },
      { periodLabel: '2026-02', billAmount: 12000, kwh: 1000, source: 'observed' },
      { periodLabel: '2026-03', billAmount: 15000, kwh: 1300, source: 'observed' },
    ]);

    expect(summarizeBillHistory(result.months)).toMatchObject({
      averageMonthlyBill: 12000,
      averageMonthlyKwh: 1000,
      annualBill: 144000,
      annualKwh: 12000,
    });
  });
});
