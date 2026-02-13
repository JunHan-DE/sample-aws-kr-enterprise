'use client';

import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import { MODEL_PRICING } from '@/lib/constants/pricing';
import { formatCurrency } from '@/lib/utils/format';
import type { MetricDataPoint } from '@/lib/types/metrics';

interface OutputInputRatioProps {
  data: MetricDataPoint[];
}

export function OutputInputRatio({ data }: OutputInputRatioProps) {
  const { resolvedTheme } = useTheme();

  const option = useMemo(() => {
    if (data.length === 0) return null;

    // Collect all model IDs present in the data
    const modelIds = new Set<string>();
    for (const point of data) {
      for (const id of Object.keys(point.inputTokens)) modelIds.add(id);
      for (const id of Object.keys(point.outputTokens)) modelIds.add(id);
    }

    if (modelIds.size === 0) return null;

    const models: Array<{
      name: string;
      inputCost: number;
      outputCost: number;
    }> = [];

    for (const modelId of modelIds) {
      const pricing = MODEL_PRICING[modelId];
      if (!pricing) continue;

      const totalInputTokens = data.reduce(
        (sum, p) => sum + (p.inputTokens[modelId] ?? 0),
        0,
      );
      const totalOutputTokens = data.reduce(
        (sum, p) => sum + (p.outputTokens[modelId] ?? 0),
        0,
      );

      const inputCost = (totalInputTokens / 1_000_000) * pricing.input;
      const outputCost = (totalOutputTokens / 1_000_000) * pricing.output;

      if (inputCost + outputCost <= 0) continue;

      models.push({
        name: pricing.shortName,
        inputCost,
        outputCost,
      });
    }

    if (models.length === 0) return null;

    // Sort by total cost descending so the largest bar is at the top
    models.sort((a, b) => (b.inputCost + b.outputCost) - (a.inputCost + a.outputCost));

    const modelNames = models.map((m) => m.name);
    const inputCosts = models.map((m) => parseFloat(m.inputCost.toFixed(4)));
    const outputCosts = models.map((m) => parseFloat(m.outputCost.toFixed(4)));

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: Array<{ marker: string; seriesName: string; value: number; axisValueLabel: string }>) => {
          const header = params[0].axisValueLabel;
          const total = params.reduce((s, p) => s + p.value, 0);
          const lines = params.map((p) => {
            const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : '0.0';
            return `${p.marker} ${p.seriesName}: ${formatCurrency(p.value)} (${pct}%)`;
          });
          return `${header}<br/>${lines.join('<br/>')}<br/><b>Total: ${formatCurrency(total)}</b>`;
        },
      },
      legend: {
        bottom: 0,
        data: ['Input Cost', 'Output Cost'],
      },
      grid: { left: 100, right: 40, top: 20, bottom: 50 },
      xAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => formatCurrency(v) },
      },
      yAxis: {
        type: 'category' as const,
        data: modelNames,
        axisLabel: { fontSize: 11 },
      },
      series: [
        {
          name: 'Input Cost',
          type: 'bar',
          stack: 'cost',
          data: inputCosts,
          itemStyle: { color: '#3b82f6' },
          emphasis: { focus: 'series' as const },
        },
        {
          name: 'Output Cost',
          type: 'bar',
          stack: 'cost',
          data: outputCosts,
          itemStyle: { color: '#8b5cf6' },
          emphasis: { focus: 'series' as const },
        },
      ],
    };
  }, [data]);

  if (!option) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      theme={resolvedTheme === 'dark' ? 'dark' : undefined}
      style={{ width: '100%', height: '400px' }}
      opts={{ renderer: 'svg' }}
    />
  );
}
