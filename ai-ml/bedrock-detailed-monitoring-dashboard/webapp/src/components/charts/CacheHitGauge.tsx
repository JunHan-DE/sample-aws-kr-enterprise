'use client';

import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import type { MetricDataPoint } from '@/lib/types/metrics';
import { calculateCacheHitRate } from '@/lib/utils/calculate';

interface CacheHitGaugeProps {
  data: MetricDataPoint[];
}

export function CacheHitGauge({ data }: CacheHitGaugeProps) {
  const { resolvedTheme } = useTheme();

  const option = useMemo(() => {
    if (data.length === 0) return null;

    const hitRate = calculateCacheHitRate(data);

    return {
      series: [
        {
          type: 'gauge',
          startAngle: 200,
          endAngle: -20,
          center: ['50%', '55%'],
          radius: '95%',
          min: 0,
          max: 100,
          splitNumber: 10,
          axisLine: {
            lineStyle: {
              width: 20,
              color: [
                [0.5, '#ef4444'],
                [0.8, '#f59e0b'],
                [1, '#10b981'],
              ],
            },
          },
          pointer: {
            itemStyle: {
              color: 'auto',
            },
            width: 4,
            length: '60%',
          },
          axisTick: {
            distance: -20,
            length: 6,
            lineStyle: {
              color: '#999',
              width: 1,
            },
          },
          splitLine: {
            distance: -20,
            length: 20,
            lineStyle: {
              color: '#999',
              width: 1,
            },
          },
          axisLabel: {
            color: resolvedTheme === 'dark' ? '#94a3b8' : '#64748b',
            fontSize: 11,
            distance: 28,
            formatter: (value: number) => `${value}`,
          },
          detail: {
            valueAnimation: true,
            formatter: (value: number) => `${value.toFixed(1)}%`,
            fontSize: 28,
            fontWeight: 'bold',
            color: resolvedTheme === 'dark' ? '#e2e8f0' : '#1e293b',
            offsetCenter: [0, '20%'],
          },
          title: {
            offsetCenter: [0, '40%'],
            fontSize: 13,
            color: resolvedTheme === 'dark' ? '#94a3b8' : '#64748b',
          },
          data: [
            {
              value: Math.round(hitRate * 10) / 10,
              name: 'Cache Hit Rate',
            },
          ],
        },
      ],
    };
  }, [data, resolvedTheme]);

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
