'use client';

import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import { MODEL_PRICING, FAMILY_COLORS } from '@/lib/constants/pricing';
import { formatCurrency, formatLatency } from '@/lib/utils/format';

interface ModelStats {
  modelId: string;
  totalCost: number;
  totalTokens: number;
  avgLatency: number;
  invocations: number;
  cacheHitRate: number;
}

interface CostEfficiencyScatterProps {
  models: ModelStats[];
}

export function CostEfficiencyScatter({ models }: CostEfficiencyScatterProps) {
  const { resolvedTheme } = useTheme();

  const option = useMemo(() => {
    const valid = models.filter((m) => m.invocations > 0 && m.avgLatency > 0);
    if (valid.length === 0) return null;

    // Determine bubble size range based on invocation counts
    const maxInvocations = Math.max(...valid.map((m) => m.invocations));
    const minBubble = 15;
    const maxBubble = 60;

    const seriesData = valid.map((m) => {
      const pricing = MODEL_PRICING[m.modelId];
      const family = pricing?.family ?? 'haiku';
      const name = pricing?.shortName ?? m.modelId;
      const costPerInvocation = m.totalCost / m.invocations;

      // Scale bubble size proportionally to invocation count
      const ratio = maxInvocations > 0 ? m.invocations / maxInvocations : 0;
      const symbolSize = minBubble + ratio * (maxBubble - minBubble);

      return {
        name,
        value: [m.avgLatency, costPerInvocation, m.invocations],
        symbolSize,
        itemStyle: { color: FAMILY_COLORS[family] },
      };
    });

    return {
      tooltip: {
        trigger: 'item' as const,
        formatter: (params: { name: string; value: [number, number, number] }) => {
          const [latency, costPerInv, invocations] = params.value;
          return [
            `<b>${params.name}</b>`,
            `Avg Latency: ${formatLatency(latency)}`,
            `Cost / Invocation: ${formatCurrency(costPerInv)}`,
            `Total Invocations: ${invocations.toLocaleString()}`,
          ].join('<br/>');
        },
      },
      grid: { left: 80, right: 40, top: 20, bottom: 50 },
      xAxis: {
        type: 'value' as const,
        name: 'Avg Latency (ms)',
        nameLocation: 'middle' as const,
        nameGap: 30,
        axisLabel: { formatter: (v: number) => formatLatency(v) },
      },
      yAxis: {
        type: 'value' as const,
        name: 'Cost / Invocation',
        nameLocation: 'middle' as const,
        nameGap: 60,
        axisLabel: { formatter: (v: number) => formatCurrency(v) },
      },
      series: [
        {
          type: 'scatter',
          data: seriesData,
          label: {
            show: true,
            formatter: (params: { name: string }) => params.name,
            position: 'top' as const,
            fontSize: 11,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0,0,0,0.3)',
            },
          },
        },
      ],
    };
  }, [models]);

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
