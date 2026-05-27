import type { BillHistoryMonth } from '../types';

export interface EnergyChartDatum {
  label: string;
  billAmount: number;
  kwh?: number;
  observedBill?: number;
  annualizedBill?: number;
}

export interface LocalMeralcoFixtureExtraction {
  label: string;
  provider: string;
  confidence: number;
  accountName?: string;
  series: BillHistoryMonth[];
}

export function buildEnergyChartData(months: BillHistoryMonth[]): EnergyChartDatum[] {
  return months.slice(0, 12).map((month) => ({
    label: month.periodLabel,
    billAmount: month.billAmount,
    kwh: month.kwh,
    observedBill: month.source === 'observed' ? month.billAmount : undefined,
    annualizedBill: month.source === 'annualized' ? month.billAmount : undefined,
  }));
}

const localFixtureExtractors: Record<string, LocalMeralcoFixtureExtraction> = {
  'FB_IMG_1779349746679.jpg': {
    label: 'Local fixture extraction from Meralco bill photo',
    provider: 'Meralco',
    confidence: 0.72,
    series: [
      { periodLabel: 'Apr 2026', billAmount: 1127.11, kwh: 357, source: 'observed' },
      { periodLabel: 'May 2026', billAmount: 1452.75, kwh: 477, source: 'observed' },
    ],
  },
  'FB_IMG_1779374132169.jpg': {
    label: 'Local fixture extraction from Meralco net-metering bill',
    provider: 'Meralco',
    confidence: 0.84,
    series: [
      { periodLabel: 'Feb-Mar 2026', billAmount: 5.66, kwh: 350, source: 'observed' },
    ],
  },
};

export function localMeralcoFixtureExtraction(fileName: string): LocalMeralcoFixtureExtraction | undefined {
  return localFixtureExtractors[fileName];
}
