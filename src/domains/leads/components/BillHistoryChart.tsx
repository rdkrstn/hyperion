import { Badge, Info } from '../../../shared/ui/primitives';
import { php } from '../../../shared/utils/format';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { annualizeBillHistory, summarizeBillHistory } from '../services/billHistoryService';
import { buildEnergyChartData } from '../services/energyChartService';
import type { BillHistoryMonth } from '../types';

interface BillHistoryChartProps {
  months?: BillHistoryMonth[];
}

export function BillHistoryChart({ months = [] }: BillHistoryChartProps) {
  if (!months.length) return null;
  const annualized = annualizeBillHistory(months);
  const summary = summarizeBillHistory(annualized.months);
  const chartData = buildEnergyChartData(annualized.months);
  const chartConfig = {
    observedBill: { label: 'Observed bill', color: '#111827' },
    annualizedBill: { label: 'Annualized bill', color: '#d97706' },
  } satisfies ChartConfig;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">12-month bill graph</p>
          <p className="text-sm text-muted-foreground">
            {annualized.annualized
              ? `${annualized.sourceMonthCount} observed months annualized with the average.`
              : 'Observed 12-month bill history.'}
          </p>
        </div>
        <Badge tone={annualized.annualized ? 'warning' : 'success'}>
          {annualized.annualized ? 'Annualized' : 'Observed'}
        </Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Info label="Average bill" value={php.format(summary.averageMonthlyBill)} />
        <Info label="Average kWh" value={summary.averageMonthlyKwh ? `${summary.averageMonthlyKwh.toLocaleString()} kWh` : 'Needs review'} />
        <Info label="Annual bill" value={php.format(summary.annualBill)} />
        <Info label="Annual kWh" value={summary.annualKwh ? `${summary.annualKwh.toLocaleString()} kWh` : 'Needs review'} />
      </div>
      <ChartContainer config={chartConfig} className="h-72 w-full rounded-lg bg-muted/20 p-3">
        <BarChart data={chartData} margin={{ left: 4, right: 8, top: 12, bottom: 10 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={10} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={56} tickFormatter={(value) => `₱${Number(value).toLocaleString()}`} />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel={false} formatter={(value, name) => (
              <div className="flex min-w-40 items-center justify-between gap-4">
                <span>{name === 'observedBill' ? 'Observed bill' : 'Annualized bill'}</span>
                <span className="font-mono font-medium">{php.format(Number(value))}</span>
              </div>
            )} />}
          />
          <Bar dataKey="observedBill" fill="var(--color-observedBill)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="annualizedBill" fill="var(--color-annualizedBill)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span><span className="mr-1 inline-block size-2 rounded-sm bg-primary" />Observed</span>
        <span><span className="mr-1 inline-block size-2 rounded-sm border border-dashed border-amber-400 bg-amber-100" />Annualized estimate</span>
      </div>
    </div>
  );
}
