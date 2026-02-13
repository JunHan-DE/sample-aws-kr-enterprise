'use client';

import { useQuery } from '@tanstack/react-query';
import { MODEL_PRICING, MODEL_IDS, FAMILY_COLORS } from '@/lib/constants/pricing';
import type { CostForecast } from '@/lib/types/metrics';
import { formatCurrency } from '@/lib/utils/format';
import { fetchApi } from '@/lib/api';

export default function PricingPage() {
  const { data: forecast } = useQuery<CostForecast>({
    queryKey: ['cost-forecast'],
    queryFn: () => fetchApi<CostForecast>('/api/cost/forecast'),
  });

  const now = new Date();
  const currentMonthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const daysRemaining = forecast ? forecast.daysInMonth - forecast.daysElapsed : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Pricing</h1>

      {/* Pricing Reference Table */}
      <section className="rounded-lg border border-border bg-card p-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Model Pricing Reference</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Per-million-token pricing used by the cost aggregator.
            Based on{' '}
            <a href="https://aws.amazon.com/bedrock/pricing/" target="_blank" rel="noopener noreferrer"
               className="text-primary underline hover:text-primary/80">
              AWS Bedrock On-Demand pricing
            </a>{' '}
            (US East — N. Virginia). US Regional endpoints include a 10% premium.
            Cache Write is based on the 5-minute TTL rate.
          </p>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="pb-3 pr-4">Model</th>
                <th className="pb-3 px-2 text-right">Input</th>
                <th className="pb-3 px-2 text-right">Output</th>
                <th className="pb-3 px-2 text-right">Cache Write</th>
                <th className="pb-3 px-2 text-right">Cache Read</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {MODEL_IDS.map((modelId) => {
                const m = MODEL_PRICING[modelId];
                return (
                  <tr key={modelId} className="text-foreground">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: FAMILY_COLORS[m.family] }}
                        />
                        <span className="font-medium">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">${m.input.toFixed(2)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">${m.output.toFixed(2)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">${m.cacheWrite.toFixed(2)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">${m.cacheRead.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          All prices in USD per million tokens. Costs are calculated at aggregation time by the Lambda function and stored in DynamoDB.
        </p>
      </section>

      {/* Current Status */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Current Status</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentMonthLabel} &middot; {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
        </p>
        <div className="mt-5 space-y-4">
          {forecast && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-md border border-border p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Daily Average</p>
                <p className="mt-1 text-xl font-bold text-foreground">{formatCurrency(forecast.dailyAverage)}</p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Projected Month-End</p>
                <p className="mt-1 text-xl font-bold text-foreground">{formatCurrency(forecast.projectedMonthEnd)}</p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Trend</p>
                <p className={`mt-1 text-xl font-bold capitalize ${
                  forecast.trend === 'increasing' ? 'text-red-400'
                    : forecast.trend === 'decreasing' ? 'text-green-400'
                    : 'text-yellow-400'
                }`}>
                  {forecast.trend}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
