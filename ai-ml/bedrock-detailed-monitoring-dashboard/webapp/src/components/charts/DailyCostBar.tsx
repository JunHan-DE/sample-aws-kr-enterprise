'use client';

import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import type { MetricDataPoint } from '@/lib/types/metrics';
import { MODEL_PRICING, FAMILY_COLORS } from '@/lib/constants/pricing';
import { formatCurrency, formatTimestamp } from '@/lib/utils/format';

interface DailyCostBarProps {
  data: MetricDataPoint[];
}

export function DailyCostBar({ data }: DailyCostBarProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const option = useMemo(() => {
    if (data.length === 0) return null;

    // Group by date -> model -> total cost
    const byDate = new Map<string, Map<string, number>>();
    const allModels = new Set<string>();

    for (const point of data) {
      const date = point.timestamp.slice(0, 10);
      if (!byDate.has(date)) byDate.set(date, new Map());
      const dateMap = byDate.get(date)!;
      for (const [modelId, cost] of Object.entries(point.cost)) {
        if (cost <= 0) continue;
        allModels.add(modelId);
        dateMap.set(modelId, (dateMap.get(modelId) ?? 0) + cost);
      }
    }

    const sortedDates = Array.from(byDate.keys()).sort();
    const xLabels = sortedDates.map((d) => formatTimestamp(d, 'daily'));

    const series = Array.from(allModels).map((modelId) => {
      const pricing = MODEL_PRICING[modelId];
      const family = pricing?.family ?? 'haiku';
      const label = pricing?.shortName ?? modelId;
      return {
        name: label,
        type: 'bar' as const,
        stack: 'dailyCost',
        data: sortedDates.map((date) => byDate.get(date)?.get(modelId) ?? 0),
        itemStyle: { color: FAMILY_COLORS[family] },
        emphasis: { focus: 'series' as const },
      };
    });

    const textColor = isDark ? '#94a3b8' : '#64748b';

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: Array<{ dataIndex: number; marker: string; seriesName: string; value: number }>) => {
          if (!params.length) return '';
          const header = xLabels[params[0].dataIndex];
          let total = 0;
          const lines = params
            .filter((p) => p.value > 0)
            .map((p) => {
              total += p.value;
              return `${p.marker} ${p.seriesName}: ${formatCurrency(p.value)}`;
            });
          return `<strong>${header}</strong><br/>${lines.join('<br/>')}<br/><br/><strong>Total: ${formatCurrency(total)}</strong>`;
        },
      },
      legend: {
        bottom: 0,
        type: 'scroll' as const,
        textStyle: { color: textColor },
      },
      grid: { left: 60, right: 20, top: 20, bottom: 50 },
      xAxis: {
        type: 'category' as const,
        data: xLabels,
        axisLabel: { fontSize: 11, color: textColor },
        axisLine: { lineStyle: { color: textColor } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          formatter: (v: number) => formatCurrency(v),
          color: textColor,
        },
        splitLine: {
          lineStyle: { color: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(100,116,139,0.1)' },
        },
      },
      series,
    };
  }, [data, isDark]);

  if (data.length === 0 || !option) {
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
