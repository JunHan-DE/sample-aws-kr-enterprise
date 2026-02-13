'use client';

import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import { formatCurrency, formatTimestamp } from '@/lib/utils/format';
import { MODEL_PRICING, MODEL_FAMILIES, FAMILY_COLORS } from '@/lib/constants/pricing';
import type { MetricDataPoint } from '@/lib/types/metrics';
import type { ModelFamily } from '@/lib/constants/pricing';

interface CostPerInvocationProps {
  data: MetricDataPoint[];
}

export function CostPerInvocation({ data }: CostPerInvocationProps) {
  const { resolvedTheme } = useTheme();

  const option = useMemo(() => {
    if (data.length === 0) return null;

    const timestamps = data.map((p) => formatTimestamp(p.timestamp, 'daily'));

    // For each family, compute cost-per-invocation at each data point
    const familySeries = MODEL_FAMILIES.map((family) => {
      const modelIdsForFamily = Object.entries(MODEL_PRICING)
        .filter(([, info]) => info.family === family)
        .map(([id]) => id);

      const values: (number | null)[] = data.map((point) => {
        let totalCost = 0;
        let totalInvocations = 0;

        for (const modelId of modelIdsForFamily) {
          totalCost += point.cost[modelId] ?? 0;
          totalInvocations += point.invocations[modelId] ?? 0;
        }

        if (totalInvocations === 0) return null;
        return parseFloat((totalCost / totalInvocations).toFixed(6));
      });

      return {
        name: family.charAt(0).toUpperCase() + family.slice(1),
        family,
        values,
      };
    });

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: Array<{ marker: string; seriesName: string; value: number | null; dataIndex: number }>) => {
          const header = timestamps[params[0].dataIndex];
          const lines = params
            .filter((p) => p.value !== null && p.value !== undefined)
            .map((p) => `${p.marker} ${p.seriesName}: ${formatCurrency(p.value!)}`);
          if (lines.length === 0) return `${header}<br/><span style="color:#999">No invocations</span>`;
          return `${header}<br/>${lines.join('<br/>')}`;
        },
      },
      legend: {
        bottom: 30,
        data: familySeries.map((s) => s.name),
      },
      grid: { left: 70, right: 20, top: 20, bottom: 80 },
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
        { type: 'slider', bottom: 0, height: 20 },
      ],
      series: familySeries.map((s) => ({
        name: s.name,
        type: 'line',
        smooth: true,
        data: s.values,
        connectNulls: false,
        lineStyle: { width: 2, color: FAMILY_COLORS[s.family as ModelFamily] },
        itemStyle: { color: FAMILY_COLORS[s.family as ModelFamily] },
        symbol: 'circle',
        symbolSize: 4,
      })),
    };
  }, [data]);

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
