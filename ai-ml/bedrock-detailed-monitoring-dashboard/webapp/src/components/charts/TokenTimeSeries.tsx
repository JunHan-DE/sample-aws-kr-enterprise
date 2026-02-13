'use client';

import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import type { MetricDataPoint } from '@/lib/types/metrics';
import { formatNumber, formatTimestamp } from '@/lib/utils/format';

interface TokenTimeSeriesProps {
  data: MetricDataPoint[];
}

export function TokenTimeSeries({ data }: TokenTimeSeriesProps) {
  const { resolvedTheme } = useTheme();

  const option = useMemo(() => {
    if (data.length === 0) return null;

    const timestamps = data.map((p) => formatTimestamp(p.timestamp));

    const sumField = (point: MetricDataPoint, field: 'inputTokens' | 'outputTokens') =>
      Object.values(point[field]).reduce((s, v) => s + v, 0);

    const inputSeries = data.map((p) => sumField(p, 'inputTokens'));
    const outputSeries = data.map((p) => sumField(p, 'outputTokens'));

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: Array<{ marker: string; seriesName: string; value: number; dataIndex: number }>) => {
          let header = '';
          const lines = params.map((p, i) => {
            if (i === 0) header = timestamps[params[0].dataIndex];
            return `${p.marker} ${p.seriesName}: ${formatNumber(p.value)}`;
          });
          const total = params.reduce((s, p) => s + p.value, 0);
          return `${header}<br/>${lines.join('<br/>')}<br/><b>Total: ${formatNumber(total)}</b>`;
        },
      },
      legend: { bottom: 0, data: ['Input Tokens', 'Output Tokens'] },
      grid: { left: 60, right: 20, top: 20, bottom: 50 },
      xAxis: {
        type: 'category' as const,
        data: timestamps,
        axisLabel: { rotate: 0, fontSize: 11, interval: 'auto' },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => formatNumber(v) },
      },
      series: [
        {
          name: 'Input Tokens',
          type: 'bar',
          stack: 'tokens',
          data: inputSeries,
          itemStyle: { color: '#3b82f6' },
        },
        {
          name: 'Output Tokens',
          type: 'bar',
          stack: 'tokens',
          data: outputSeries,
          itemStyle: { color: '#8b5cf6' },
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
