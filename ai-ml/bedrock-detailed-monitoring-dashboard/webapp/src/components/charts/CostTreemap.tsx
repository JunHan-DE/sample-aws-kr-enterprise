'use client';

import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import { MODEL_PRICING, FAMILY_COLORS } from '@/lib/constants/pricing';
import { formatCurrency } from '@/lib/utils/format';

interface CostTreemapProps {
  costByModel: Record<string, number>;
}

export function CostTreemap({ costByModel }: CostTreemapProps) {
  const { resolvedTheme } = useTheme();

  const option = useMemo(() => {
    const entries = Object.entries(costByModel).filter(([, v]) => v > 0);
    if (entries.length === 0) return null;

    const treeData = entries.map(([modelId, cost]) => {
      const pricing = MODEL_PRICING[modelId];
      const family = pricing?.family ?? 'haiku';
      const name = pricing?.name ?? modelId;
      return {
        name,
        value: cost,
        itemStyle: { color: FAMILY_COLORS[family] },
      };
    });

    return {
      tooltip: {
        formatter: (params: { name: string; value: number }) =>
          `${params.name}<br/>Cost: ${formatCurrency(params.value)}`,
      },
      series: [
        {
          type: 'treemap',
          roam: false,
          width: '100%',
          height: '90%',
          data: treeData,
          label: {
            show: true,
            formatter: (params: { name: string; value: number }) =>
              `${params.name}\n${formatCurrency(params.value)}`,
            fontSize: 12,
            color: resolvedTheme === 'dark' ? '#e2e8f0' : '#fff',
          },
          breadcrumb: { show: false },
          itemStyle: { borderColor: resolvedTheme === 'dark' ? '#1e293b' : '#fff', borderWidth: 2 },
          emphasis: {
            label: { fontSize: 14 },
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
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
