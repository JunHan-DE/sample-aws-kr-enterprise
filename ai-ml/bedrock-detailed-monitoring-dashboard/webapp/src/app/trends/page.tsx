'use client';

import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, DollarSign, Activity, BarChart3 } from 'lucide-react';
import { formatCurrency, formatTimestamp } from '@/lib/utils/format';
import { fetchApi } from '@/lib/api';
import type { MetricDataPoint, CostForecast } from '@/lib/types/metrics';
import { CostPerInvocation } from '@/components/charts/CostPerInvocation';
import { CacheHitTrend } from '@/components/charts/CacheHitTrend';

interface HistoryResponse {
  data: MetricDataPoint[];
  granularity: string;
  timeRange: string;
}

function sumField(point: MetricDataPoint, field: 'cost' | 'invocations' | 'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheWriteTokens'): number {
  return Object.values(point[field]).reduce((s, v) => s + v, 0);
}

export default function TrendsPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const { isLoading: loading7d } = useQuery<HistoryResponse>({
    queryKey: ['metrics', 'history', '7d'],
    queryFn: () => fetchApi('/api/metrics/history', { range: '7d' }),
  });

  // Fetch hourly data for the Peak Hours radar chart (daily granularity loses hour info)
  const { data: history7dHourly, isLoading: loading7dHourly } = useQuery<HistoryResponse>({
    queryKey: ['metrics', 'history', '7d', 'hourly'],
    queryFn: () => fetchApi('/api/metrics/history', { range: '7d', granularity: 'hourly' }),
  });

  const { data: history30d, isLoading: loading30d } = useQuery<HistoryResponse>({
    queryKey: ['metrics', 'history', '30d'],
    queryFn: () => fetchApi('/api/metrics/history', { range: '30d' }),
  });

  const { data: forecast, isLoading: loadingForecast } = useQuery<CostForecast>({
    queryKey: ['cost', 'forecast'],
    queryFn: () => fetchApi('/api/cost/forecast'),
  });

  const data30d = history30d?.data ?? [];

  // 7-Day Moving Average chart options
  const movingAvgOption = useMemo(() => {
    if (data30d.length === 0) return null;

    const timestamps = data30d.map((p) => formatTimestamp(p.timestamp, 'daily'));
    const dailyCosts = data30d.map((p) => sumField(p, 'cost'));

    const movingAvg: (number | null)[] = dailyCosts.map((_, i) => {
      if (i < 6) return null;
      let sum = 0;
      for (let j = i - 6; j <= i; j++) {
        sum += dailyCosts[j];
      }
      return parseFloat((sum / 7).toFixed(4));
    });

    // Calculate mean and standard deviation for anomaly band
    const validAvgs = movingAvg.filter((v): v is number => v !== null);
    const mean = validAvgs.length > 0 ? validAvgs.reduce((s, v) => s + v, 0) / validAvgs.length : 0;
    const sd = validAvgs.length > 0
      ? Math.sqrt(validAvgs.reduce((s, v) => s + (v - mean) ** 2, 0) / validAvgs.length)
      : 0;
    const upperBand = mean + 2 * sd;
    const lowerBand = Math.max(0, mean - 2 * sd);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: Array<{ marker: string; seriesName: string; value: number | null; dataIndex: number }>) => {
          const header = timestamps[params[0].dataIndex];
          const lines = params
            .filter((p) => p.value !== null)
            .map((p) => `${p.marker} ${p.seriesName}: ${formatCurrency(p.value!)}`);
          return `${header}<br/>${lines.join('<br/>')}`;
        },
      },
      legend: { bottom: 30, data: ['Daily Cost', '7-Day Moving Avg'] },
      grid: { left: 60, right: 20, top: 20, bottom: 80 },
      xAxis: {
        type: 'category' as const,
        data: timestamps,
        axisLabel: { rotate: 0, fontSize: 11, interval: 'auto' },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => formatCurrency(v) },
      },
      dataZoom: [
        { type: 'slider', bottom: 10, height: 20 },
      ],
      series: [
        {
          name: 'Daily Cost',
          type: 'line',
          data: dailyCosts,
          lineStyle: { width: 1, type: 'dotted' as const, color: '#94a3b8' },
          itemStyle: { color: '#94a3b8' },
          symbol: 'circle',
          symbolSize: 4,
        },
        {
          name: '7-Day Moving Avg',
          type: 'line',
          data: movingAvg,
          smooth: true,
          lineStyle: { width: 3, color: '#3b82f6' },
          itemStyle: { color: '#3b82f6' },
          symbol: 'none',
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.2)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0)' },
              ],
            },
          },
          markArea: {
            silent: true,
            itemStyle: { color: 'rgba(239, 68, 68, 0.08)' },
            data: [
              [
                { yAxis: lowerBand },
                { yAxis: upperBand },
              ],
            ],
            label: {
              show: false,
            },
          },
        },
      ],
    };
  }, [data30d]);

  // Peak Hours radar chart (uses hourly granularity data for correct hour bucketing)
  const data7dHourly = history7dHourly?.data ?? [];
  const peakHoursOption = useMemo(() => {
    if (data7dHourly.length === 0) return null;

    const hourlyInvocations = new Array(24).fill(0);

    for (const point of data7dHourly) {
      const hour = new Date(point.timestamp).getHours();
      hourlyInvocations[hour] += sumField(point, 'invocations');
    }

    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: { name: string; value: number; marker: string }) =>
          `${params.marker} ${params.name}: ${params.value.toLocaleString()} invocations`,
      },
      angleAxis: {
        type: 'category' as const,
        data: hours,
        axisTick: { show: false },
        axisLabel: { fontSize: 10, color: isDark ? '#94a3b8' : '#64748b' },
      },
      radiusAxis: {
        axisLabel: { fontSize: 10 },
      },
      polar: {},
      series: [
        {
          type: 'line',
          data: hourlyInvocations,
          coordinateSystem: 'polar',
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            color: '#8b5cf6',
            width: 2,
          },
          itemStyle: {
            color: '#8b5cf6',
          },
          areaStyle: {
            color: 'rgba(139, 92, 246, 0.15)',
          },
          name: 'Invocations by Hour (KST)',
        },
      ],
    };
  }, [data7dHourly, isDark]);

  const isLoading = loading7d || loading7dHourly || loading30d || loadingForecast;

  const trendIcon = forecast?.trend === 'increasing'
    ? <TrendingUp className="h-5 w-5 text-red-500" />
    : forecast?.trend === 'decreasing'
      ? <TrendingDown className="h-5 w-5 text-green-500" />
      : <Minus className="h-5 w-5 text-yellow-500" />;

  const trendLabel = forecast?.trend === 'increasing'
    ? 'Increasing'
    : forecast?.trend === 'decreasing'
      ? 'Decreasing'
      : 'Stable';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Trends & Forecast</h1>

      {/* Forecast highlight cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Projected Month End Cost
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {isLoading ? (
              <span className="inline-block h-8 w-24 animate-pulse rounded bg-muted" />
            ) : (
              formatCurrency(forecast?.projectedMonthEnd ?? 0)
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            Daily Average Cost
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {isLoading ? (
              <span className="inline-block h-8 w-24 animate-pulse rounded bg-muted" />
            ) : (
              formatCurrency(forecast?.dailyAverage ?? 0)
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            Trend Direction
          </div>
          <div className="mt-2 flex items-center gap-2 text-2xl font-bold text-foreground">
            {isLoading ? (
              <span className="inline-block h-8 w-24 animate-pulse rounded bg-muted" />
            ) : (
              <>
                {trendIcon}
                <span>{trendLabel}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Row 1: 7-Day Moving Average */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold text-foreground">7-Day Moving Average</h2>
        {loading30d ? (
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">Loading...</div>
        ) : movingAvgOption ? (
          <ReactECharts
            option={movingAvgOption}
            theme={isDark ? 'dark' : undefined}
            style={{ width: '100%', height: '400px' }}
            opts={{ renderer: 'svg' }}
          />
        ) : (
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">No data available</div>
        )}
      </div>

      {/* Row 2: Peak Hours */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Peak Hours (KST)</h2>
        {(loading7d || loading7dHourly) ? (
          <div className="flex h-[350px] items-center justify-center text-muted-foreground">Loading...</div>
        ) : peakHoursOption ? (
          <ReactECharts
            option={peakHoursOption}
            theme={isDark ? 'dark' : undefined}
            style={{ width: '100%', height: '350px' }}
            opts={{ renderer: 'svg' }}
          />
        ) : (
          <div className="flex h-[350px] items-center justify-center text-muted-foreground">No data available</div>
        )}
      </div>

      {/* Row 3: Cost Per Invocation */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Cost Per Invocation Trend</h2>
        {loading30d ? (
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          <CostPerInvocation data={data30d} />
        )}
      </div>

      {/* Row 4: Cache Hit Rate */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Cache Hit Rate Trend</h2>
        {loading30d ? (
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          <CacheHitTrend data={data30d} />
        )}
      </div>
    </div>
  );
}
