import { describe, expect, it } from 'vitest';
import { buildEnergyChartData, localMeralcoFixtureExtraction } from './energyChartService';
import type { BillHistoryMonth } from '../types';

describe('energy chart service', () => {
  it('marks observed bars separately from annualized bars', () => {
    const months: BillHistoryMonth[] = [
      { periodLabel: 'Jan', billAmount: 1000, kwh: 80, source: 'observed' },
      { periodLabel: 'Feb', billAmount: 1200, kwh: 96, source: 'observed' },
      { periodLabel: 'Annualized 3', billAmount: 1100, kwh: 88, source: 'annualized' },
    ];

    const chart = buildEnergyChartData(months);

    expect(chart).toEqual([
      { label: 'Jan', billAmount: 1000, kwh: 80, observedBill: 1000, annualizedBill: undefined },
      { label: 'Feb', billAmount: 1200, kwh: 96, observedBill: 1200, annualizedBill: undefined },
      { label: 'Annualized 3', billAmount: 1100, kwh: 88, observedBill: undefined, annualizedBill: 1100 },
    ]);
  });

  it('extracts known local Meralco fixture values for recording fallback without pretending production OCR ran', () => {
    const extraction = localMeralcoFixtureExtraction('FB_IMG_1779374132169.jpg');

    expect(extraction?.provider).toBe('Meralco');
    expect(extraction?.series[0]).toMatchObject({
      periodLabel: 'Feb-Mar 2026',
      billAmount: 5.66,
      kwh: 350,
      source: 'observed',
    });
    expect(extraction?.label).toContain('Local fixture');
  });
});
