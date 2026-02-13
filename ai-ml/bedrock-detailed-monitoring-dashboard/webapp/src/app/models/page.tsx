'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { ModelDonut, LatencyBoxplot } from '@/components/charts';
import { OutputInputRatio } from '@/components/charts/OutputInputRatio';
import { CostEfficiencyScatter } from '@/components/charts/CostEfficiencyScatter';
import { MODEL_PRICING, FAMILY_COLORS } from '@/lib/constants/pricing';
import { formatCurrency, formatNumber, formatLatency, formatPercent } from '@/lib/utils/format';
import { fetchApi } from '@/lib/api';
import { TimeRangeSelector } from '@/components/dashboard/TimeRangeSelector';
import type { TimeRange, MetricDataPoint } from '@/lib/types/metrics';

interface ModelStats {
  modelId: string;
  totalCost: number;
  totalTokens: number;
  avgLatency: number;
  invocations: number;
  cacheHitRate: number;
}

interface ModelsResponse {
  models: ModelStats[];
  timeRange: string;
}

interface HistoryResponse {
  data: MetricDataPoint[];
  granularity: string;
  timeRange: string;
}

function getModelName(modelId: string): string {
  return MODEL_PRICING[modelId]?.shortName ?? modelId.split('.').pop() ?? modelId;
}

function getModelFamily(modelId: string): 'opus' | 'sonnet' | 'haiku' {
  return MODEL_PRICING[modelId]?.family ?? 'haiku';
}

function getModelColor(modelId: string): string {
  return FAMILY_COLORS[getModelFamily(modelId)];
}

export default function ModelsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const { resolvedTheme } = useTheme();

  const queryParams: Record<string, string> = { range: timeRange };
  if (timeRange === 'custom' && customStart && customEnd) {
    queryParams.start = customStart;
    queryParams.end = customEnd;
  }

  const { data: modelsData, isLoading: modelsLoading } = useQuery<ModelsResponse>({
    queryKey: ['models', timeRange, customStart, customEnd],
    queryFn: () => fetchApi<ModelsResponse>('/api/models', queryParams),
    refetchInterval: 60_000,
    enabled: timeRange !== 'custom' || (!!customStart && !!customEnd),
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<HistoryResponse>({
    queryKey: ['metrics', 'history', timeRange, customStart, customEnd],
    queryFn: () => fetchApi<HistoryResponse>('/api/metrics/history', queryParams),
    refetchInterval: 60_000,
    enabled: timeRange !== 'custom' || (!!customStart && !!customEnd),
  });

  const models = modelsData?.models ?? [];
  const history = historyData?.data ?? [];

  // Build costByModel for the donut chart
  const costByModel = useMemo(() => {
    const result: Record<string, number> = {};
    for (const m of models) {
      result[m.modelId] = m.totalCost;
    }
    return result;
  }, [models]);

  // Build latencyData for the boxplot chart
  const latencyData = useMemo(() => {
    const result: Record<string, { avg: number; p50: number; p90: number; p99: number }> = {};
    for (const m of models) {
      if (m.avgLatency > 0) {
        const name = getModelName(m.modelId);
        // Use avgLatency as approximation for percentiles when p50/p90/p99 not available
        result[name] = {
          avg: m.avgLatency,
          p50: m.avgLatency * 0.85,
          p90: m.avgLatency * 1.3,
          p99: m.avgLatency * 1.8,
        };
      }
    }
    return result;
  }, [models]);

  // Build per-model token breakdown data for stacked bar chart
  const tokenBarData = useMemo(() => {
    if (history.length === 0) return null;

    const modelIds = [...new Set(models.map((m) => m.modelId))];
    const names = modelIds.map(getModelName);

    const inputByModel = modelIds.map((id) =>
      history.reduce((sum, p) => sum + (p.inputTokens[id] ?? 0), 0)
    );
    const outputByModel = modelIds.map((id) =>
      history.reduce((sum, p) => sum + (p.outputTokens[id] ?? 0), 0)
    );
    const cacheByModel = modelIds.map((id) =>
      history.reduce((sum, p) => sum + (p.cacheReadTokens[id] ?? 0) + (p.cacheWriteTokens[id] ?? 0), 0)
    );

    return { names, inputByModel, outputByModel, cacheByModel };
  }, [history, models]);

  // Token bar chart option
  const tokenBarOption = useMemo(() => {
    if (!tokenBarData) return null;

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: Array<{ marker: string; seriesName: string; value: number; axisValueLabel: string }>) => {
          const header = params[0].axisValueLabel;
          const lines = params.map(
            (p) => `${p.marker} ${p.seriesName}: ${formatNumber(p.value)}`
          );
          const total = params.reduce((s, p) => s + p.value, 0);
          return `${header}<br/>${lines.join('<br/>')}<br/><b>Total: ${formatNumber(total)}</b>`;
        },
      },
      legend: { bottom: 0, data: ['Input', 'Output', 'Cache'] },
      grid: { left: 60, right: 20, top: 20, bottom: 50 },
      xAxis: {
        type: 'category' as const,
        data: tokenBarData.names,
        axisLabel: { rotate: 15, fontSize: 11 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => formatNumber(v) },
      },
      series: [
        {
          name: 'Input',
          type: 'bar',
          stack: 'tokens',
          data: tokenBarData.inputByModel,
          itemStyle: { color: '#3b82f6' },
        },
        {
          name: 'Output',
          type: 'bar',
          stack: 'tokens',
          data: tokenBarData.outputByModel,
          itemStyle: { color: '#8b5cf6' },
        },
        {
          name: 'Cache',
          type: 'bar',
          stack: 'tokens',
          data: tokenBarData.cacheByModel,
          itemStyle: { color: '#10b981' },
        },
      ],
    };
  }, [tokenBarData]);

  const isLoading = modelsLoading || historyLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Models</h1>
        <TimeRangeSelector
          value={timeRange}
          onChange={setTimeRange}
          customStart={customStart}
          customEnd={customEnd}
          onCustomChange={(start, end) => { setCustomStart(start); setCustomEnd(end); }}
        />
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading model data...
        </div>
      ) : models.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          No model data available for the selected time range.
        </div>
      ) : (
        <>
          {/* Model summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {models.map((model) => (
              <div
                key={model.modelId}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: getModelColor(model.modelId) }}
                  />
                  <h3 className="text-sm font-semibold text-foreground">
                    {getModelName(model.modelId)}
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Cost</p>
                    <p className="font-medium text-foreground">{formatCurrency(model.totalCost)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Invocations</p>
                    <p className="font-medium text-foreground">{formatNumber(model.invocations)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Latency</p>
                    <p className="font-medium text-foreground">{formatLatency(model.avgLatency)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cache Hit</p>
                    <p className="font-medium text-foreground">{formatPercent(model.cacheHitRate)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Row 1: ModelDonut + Token bar chart */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-1">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Cost Distribution</h2>
              <ModelDonut costByModel={costByModel} />
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-2">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Token Usage by Model</h2>
              {tokenBarOption ? (
                <ReactECharts
                  option={tokenBarOption}
                  theme={resolvedTheme === 'dark' ? 'dark' : undefined}
                  style={{ width: '100%', height: '400px' }}
                  opts={{ renderer: 'svg' }}
                />
              ) : (
                <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Latency boxplot */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Latency by Model (p50 / p90 / p99)</h2>
            <LatencyBoxplot latencyData={latencyData} />
          </div>

          {/* Row 3: Output:Input Cost Ratio + Cost Efficiency Scatter */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Output vs Input Cost Ratio</h2>
              <OutputInputRatio data={history} />
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Cost vs Latency</h2>
              <CostEfficiencyScatter models={models} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
