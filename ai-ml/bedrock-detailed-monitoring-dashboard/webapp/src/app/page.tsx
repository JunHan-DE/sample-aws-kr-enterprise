'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import type { MetricDataPoint, TimeRange } from '@/lib/types/metrics';
import { sumByModel } from '@/lib/utils/calculate';
import { TimeRangeSelector } from '@/components/dashboard/TimeRangeSelector';
import { KpiGrid } from '@/components/dashboard/KpiGrid';
import {
  CostInterval,
  TokenTimeSeries,
  CacheTimeSeries,
  ModelDonut,
  UsageHeatmap,
} from '@/components/charts';
import { CacheHitGauge } from '@/components/charts/CacheHitGauge';

interface MetricsHistoryResponse {
  data: MetricDataPoint[];
  granularity: string;
  timeRange: string;
}

export default function OverviewPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const queryParams: Record<string, string> = { range: timeRange };
  if (timeRange === 'custom' && customStart && customEnd) {
    queryParams.start = customStart;
    queryParams.end = customEnd;
  }

  const {
    data: metricsResponse,
    isLoading: metricsLoading,
  } = useQuery({
    queryKey: ['metrics', 'history', timeRange, customStart, customEnd],
    queryFn: () =>
      fetchApi<MetricsHistoryResponse>('/api/metrics/history', queryParams),
    enabled: timeRange !== 'custom' || (!!customStart && !!customEnd),
  });

  const metrics = metricsResponse?.data ?? [];

  const costByModel = useMemo(() => sumByModel(metrics, 'cost'), [metrics]);

  const isLoading = metricsLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Overview</h1>
        <TimeRangeSelector
          value={timeRange}
          onChange={setTimeRange}
          customStart={customStart}
          customEnd={customEnd}
          onCustomChange={(start, end) => { setCustomStart(start); setCustomEnd(end); }}
        />
      </div>

      {isLoading ? (
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <KpiGrid data={metrics} />

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">Cost Over Time</h2>
            <CostInterval data={metrics} timeRange={timeRange} granularity={metricsResponse?.granularity} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-4 text-sm font-medium text-muted-foreground">Token Usage</h2>
              <TokenTimeSeries data={metrics} />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-4 text-sm font-medium text-muted-foreground">Cache Usage</h2>
              <CacheTimeSeries data={metrics} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
              <h2 className="mb-4 text-sm font-medium text-muted-foreground">Cache Hit Rate</h2>
              <CacheHitGauge data={metrics} />
            </div>
            <div className="rounded-lg border border-border bg-card p-4 lg:col-span-3">
              <h2 className="mb-4 text-sm font-medium text-muted-foreground">Cost by Model</h2>
              <ModelDonut costByModel={costByModel} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">Usage Heatmap</h2>
            <UsageHeatmap />
          </div>
        </>
      )}
    </div>
  );
}
