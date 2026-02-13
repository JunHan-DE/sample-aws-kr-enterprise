'use client';

import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import { MODEL_PRICING, FAMILY_COLORS } from '@/lib/constants/pricing';
import { formatCurrency } from '@/lib/utils/format';

interface ModelDonutProps {
  costByModel: Record<string, number>;
}

export function ModelDonut({ costByModel }: ModelDonutProps) {
  const { resolvedTheme } = useTheme();

  const option = useMemo(() => {
    const entries = Object.entries(costByModel).filter(([, v]) => v > 0);
    if (entries.length === 0) return null;

    const totalCost = entries.reduce((s, [, v]) => s + v, 0);

    const seriesData = entries.map(([modelId, cost]) => {
      const pricing = MODEL_PRICING[modelId];
      const family = pricing?.family ?? 'haiku';
      const label = pricing?.shortName ?? modelId;
      return {
        name: label,
        value: cost,
        itemStyle: { color: FAMILY_COLORS[family] },
      };
    });

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: { marker: string; name: string; value: number; percent: number }) =>
          `${params.marker} ${params.name}<br/>Cost: ${formatCurrency(params.value)}<br/>Share: ${params.percent.toFixed(1)}%`,
      },
      legend: {
        bottom: 0,
        type: 'scroll' as const,
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          label: {
            formatter: '{b}\n{d}%',
            fontSize: 11,
          },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: 'bold' },
          },
          data: seriesData,
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '40%',
          style: {
            text: formatCurrency(totalCost),
            textAlign: 'center',
            fontSize: 18,
            fontWeight: 'bold',
            fill: resolvedTheme === 'dark' ? '#e2e8f0' : '#1e293b',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '47%',
          style: {
            text: 'Total',
            textAlign: 'center',
            fontSize: 12,
            fill: resolvedTheme === 'dark' ? '#94a3b8' : '#64748b',
          },
        },
      ],
    };
  }, [costByModel, resolvedTheme]);

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
