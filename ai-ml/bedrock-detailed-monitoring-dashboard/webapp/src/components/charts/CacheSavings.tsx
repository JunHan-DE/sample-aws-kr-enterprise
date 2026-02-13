'use client';

import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import { formatCurrency } from '@/lib/utils/format';

interface CacheSavingsData {
  model: string;
  withoutCache: number;
  withCache: number;
  savings: number;
}

interface CacheSavingsProps {
  data: CacheSavingsData[];
}

export function CacheSavings({ data }: CacheSavingsProps) {
  const { resolvedTheme } = useTheme();

  const option = useMemo(() => {
    if (data.length === 0) return null;

    const models = data.map((d) => d.model);
    const withoutCache = data.map((d) => d.withoutCache);
    const withCache = data.map((d) => d.withCache);
    const savings = data.map((d) => d.savings);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: Array<{ marker: string; seriesName: string; value: number; dataIndex: number }>) => {
          const header = models[params[0].dataIndex];
          const lines = params.map(
            (p) => `${p.marker} ${p.seriesName}: ${formatCurrency(p.value)}`
          );
          return `${header}<br/>${lines.join('<br/>')}<br/><b>Savings: ${formatCurrency(savings[params[0].dataIndex])}</b>`;
        },
      },
      legend: { bottom: 0, data: ['Without Cache', 'With Cache'] },
      grid: { left: 80, right: 20, top: 30, bottom: 50 },
      xAxis: {
        type: 'category' as const,
        data: models,
        axisLabel: { rotate: 15, fontSize: 11 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => formatCurrency(v) },
      },
      series: [
        {
          name: 'Without Cache',
          type: 'bar',
          data: withoutCache,
          itemStyle: { color: '#94a3b8' },
          barGap: '10%',
        },
        {
          name: 'With Cache',
          type: 'bar',
          data: withCache,
          itemStyle: { color: '#10b981' },
          label: {
            show: true,
            position: 'top',
            formatter: (params: { dataIndex: number }) =>
              savings[params.dataIndex] > 0
                ? `-${formatCurrency(savings[params.dataIndex])}`
                : '',
            fontSize: 11,
            color: '#10b981',
          },
        },
      ],
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
