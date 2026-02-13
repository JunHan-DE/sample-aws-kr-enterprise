'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, DollarSign, Target, Calendar, Activity } from 'lucide-react';
import { DailyCostBar } from '@/components/charts/DailyCostBar';
import { CostSankey } from '@/components/charts/CostSankey';
import { CacheSavings } from '@/components/charts/CacheSavings';
import { fetchApi } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { sumByModel, totalAll } from '@/lib/utils/calculate';
import { MODEL_PRICING } from '@/lib/constants/pricing';
import { TimeRangeSelector } from '@/components/dashboard/TimeRangeSelector';
import type { MetricDataPoint, CostSummary, CostForecast, TimeRange } from '@/lib/types/metrics';

interface HistoryResponse {
  data: MetricDataPoint[];
  granularity: string;
  timeRange: string;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-border bg-card p-5">
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="mt-3 h-8 w-32 rounded bg-muted" />
      <div className="mt-2 h-3 w-20 rounded bg-muted" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="animate-pulse rounded-lg border border-border bg-card p-6">
      <div className="h-5 w-40 rounded bg-muted" />
      <div className="mt-4 h-[400px] rounded bg-muted" />
    </div>
  );
}

function TrendIcon({ trend }: { trend: CostForecast['trend'] }) {
  switch (trend) {
    case 'increasing':
      return <TrendingUp className="h-5 w-5 text-red-500" />;
    case 'decreasing':
      return <TrendingDown className="h-5 w-5 text-green-500" />;
    default:
      return <Minus className="h-5 w-5 text-yellow-500" />;
  }
}

function trendLabel(trend: CostForecast['trend']): string {
  switch (trend) {
    case 'increasing':
      return 'Increasing';
    case 'decreasing':
      return 'Decreasing';
    default:
      return 'Stable';
  }
}

function trendColor(trend: CostForecast['trend']): string {
  switch (trend) {
    case 'increasing':
      return 'text-red-500';
    case 'decreasing':
      return 'text-green-500';
    default:
      return 'text-yellow-500';
  }
}

export default function CostPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const queryParams: Record<string, string> = { range: timeRange };
  if (timeRange === 'custom' && customStart && customEnd) {
    queryParams.start = customStart;
    queryParams.end = customEnd;
  }

  const historyQuery = useQuery({
    queryKey: ['metrics', 'history', timeRange, customStart, customEnd],
    queryFn: () => fetchApi<HistoryResponse>('/api/metrics/history', queryParams),
    enabled: timeRange !== 'custom' || (!!customStart && !!customEnd),
  });

  const dailyCostQuery = useQuery({
    queryKey: ['metrics', 'history', '30d', 'daily'],
    queryFn: () => fetchApi<HistoryResponse>('/api/metrics/history', { range: '30d', granularity: 'daily' }),
  });

  const summaryQuery = useQuery({
    queryKey: ['cost', 'summary'],
    queryFn: () => fetchApi<CostSummary>('/api/cost/summary'),
  });

  const forecastQuery = useQuery({
    queryKey: ['cost', 'forecast'],
    queryFn: () => fetchApi<CostForecast>('/api/cost/forecast'),
  });

  const historyData = historyQuery.data?.data ?? [];
  const dailyCostData = dailyCostQuery.data?.data ?? [];

  const cacheSavingsData = useMemo(() => {
    const cacheReadByModel = sumByModel(historyData, 'cacheReadTokens');

    return Object.entries(cacheReadByModel)
      .filter(([, tokens]) => tokens > 0)
      .map(([modelId, tokens]) => {
        const pricing = MODEL_PRICING[modelId];
        const name = pricing?.shortName ?? modelId;
        const inputPrice = pricing?.input ?? 0;
        const cacheReadPrice = pricing?.cacheRead ?? 0;

        const withoutCache = (tokens / 1_000_000) * inputPrice;
        const withCache = (tokens / 1_000_000) * cacheReadPrice;
        const savings = withoutCache - withCache;

        return { model: name, withoutCache, withCache, savings };
      })
      .filter((d) => d.withoutCache > 0);
  }, [historyData]);

  const dailyRows = useMemo(() => {
    if (historyData.length === 0) return [];

    const byDate = new Map<string, { cost: number; tokens: number; invocations: number }>();
    for (const point of historyData) {
      const date = point.timestamp.slice(0, 10);
      const entry = byDate.get(date) ?? { cost: 0, tokens: 0, invocations: 0 };
      entry.cost += totalAll(point.cost);
      entry.tokens += totalAll(point.inputTokens) + totalAll(point.outputTokens);
      entry.invocations += totalAll(point.invocations);
      byDate.set(date, entry);
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, stats]) => ({ date, ...stats }));
  }, [historyData]);

  const forecast = forecastQuery.data;
  const summary = summaryQuery.data;
  const isLoadingCards = forecastQuery.isLoading || summaryQuery.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Cost Analysis</h1>
        <TimeRangeSelector
          value={timeRange}
          onChange={setTimeRange}
          customStart={customStart}
          customEnd={customEnd}
          onCustomChange={(start, end) => { setCustomStart(start); setCustomEnd(end); }}
        />
      </div>

      {/* Forecast summary cards */}
      {isLoadingCards ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Current Month Cost
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {formatCurrency(forecast?.currentCost ?? summary?.totalCost ?? 0)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {summary?.month ?? new Date().toISOString().slice(0, 7)}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              Projected Month End
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {formatCurrency(forecast?.projectedMonthEnd ?? 0)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {forecast ? `${forecast.daysElapsed} / ${forecast.daysInMonth} days` : '--'}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Daily Average
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {formatCurrency(forecast?.dailyAverage ?? 0)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">per day</div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              Trend
            </div>
            <div className="mt-2 flex items-center gap-2">
              {forecast && <TrendIcon trend={forecast.trend} />}
              <span className={`text-2xl font-bold ${forecast ? trendColor(forecast.trend) : 'text-foreground'}`}>
                {forecast ? trendLabel(forecast.trend) : '--'}
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">vs previous 7 days</div>
          </div>
        </div>
      )}

      {/* Row 1: Daily cost breakdown */}
      {dailyCostQuery.isLoading ? (
        <SkeletonChart />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Daily Cost Breakdown</h2>
          <DailyCostBar data={dailyCostData} />
        </div>
      )}

      {/* Row 2: Cost Flow */}
      {historyQuery.isLoading ? (
        <SkeletonChart />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Cost Flow</h2>
          <CostSankey data={historyData} />
        </div>
      )}

      {/* Row 3: Cache savings */}
      {historyQuery.isLoading ? (
        <SkeletonChart />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Cache Savings</h2>
          <CacheSavings data={cacheSavingsData} />
        </div>
      )}

      {/* Row 4: Daily cost table */}
      {dailyRows.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Daily Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-3 pr-6 font-medium">Date</th>
                  <th className="pb-3 pr-6 text-right font-medium">Cost</th>
                  <th className="pb-3 pr-6 text-right font-medium">Tokens</th>
                  <th className="pb-3 text-right font-medium">Invocations</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map((row) => (
                  <tr key={row.date} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-6 text-foreground">{row.date}</td>
                    <td className="py-3 pr-6 text-right text-foreground">{formatCurrency(row.cost)}</td>
                    <td className="py-3 pr-6 text-right text-muted-foreground">{formatNumber(row.tokens)}</td>
                    <td className="py-3 text-right text-muted-foreground">{formatNumber(row.invocations)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
