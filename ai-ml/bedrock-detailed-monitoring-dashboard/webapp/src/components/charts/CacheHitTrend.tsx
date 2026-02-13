'use client';

import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import { formatPercent, formatTimestamp } from '@/lib/utils/format';
import type { MetricDataPoint } from '@/lib/types/metrics';

interface CacheHitTrendProps {
  data: MetricDataPoint[];
}

function sumField(point: MetricDataPoint, field: 'cacheReadTokens' | 'cacheWriteTokens'): number {
  return Object.values(point[field]).reduce((s, v) => s + v, 0);
}

export function CacheHitTrend({ data }: CacheHitTrendProps) {
  const { resolvedTheme } = useTheme();

  const option = useMemo(() => {
    if (data.length === 0) return null;

    const timestamps = data.map((p) => formatTimestamp(p.timestamp, 'daily'));

    const hitRates: (number | null)[] = data.map((point) => {
      const cacheRead = sumField(point, 'cacheReadTokens');
      const cacheWrite = sumField(point, 'cacheWriteTokens');
      const total = cacheRead + cacheWrite;

      if (total === 0) return null;
      return parseFloat(((cacheRead / total) * 100).toFixed(1));
    });

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: Array<{ marker: string; seriesName: string; value: number | null; dataIndex: number }>) => {
          const header = timestamps[params[0].dataIndex];
          const p = params[0];
          if (p.value === null || p.value === undefined) {
            return `${header}<br/><span style="color:#999">No cache data</span>`;
          }
          return `${header}<br/>${p.marker} ${p.seriesName}: ${formatPercent(p.value)}`;
        },
      },
      grid: { left: 60, right: 20, top: 20, bottom: 70 },
      xAxis: {
        type: 'category' as const,
        data: timestamps,
        axisLabel: { rotate: 0, fontSize: 11, interval: 'auto' },
      },
      yAxis: {
        type: 'value' as const,
        min: 0,
        max: 100,
        axisLabel: { formatter: (v: number) => `${v}%` },
      },
      dataZoom: [
        { type: 'slider', bottom: 0, height: 20 },
      ],
      series: [
        {
          name: 'Cache Hit Rate',
          type: 'line',
          smooth: true,
          data: hitRates,
          connectNulls: false,
          lineStyle: { width: 2, color: '#10b981' },
          itemStyle: { color: '#10b981' },
          symbol: 'circle',
          symbolSize: 4,
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0)' },
              ],
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { type: 'dashed', color: '#10b981', width: 1.5 },
            label: {
              formatter: '80% target',
              position: 'insideEndTop',
              fontSize: 11,
            },
            data: [
              { yAxis: 80 },
            ],
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
