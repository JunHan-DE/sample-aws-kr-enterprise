'use client';

import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import { formatLatency } from '@/lib/utils/format';

interface LatencyData {
  avg: number;
  p50: number;
  p90: number;
  p99: number;
}

interface LatencyBoxplotProps {
  latencyData: Record<string, LatencyData>;
}

export function LatencyBoxplot({ latencyData }: LatencyBoxplotProps) {
  const { resolvedTheme } = useTheme();

  const option = useMemo(() => {
    const entries = Object.entries(latencyData);
    if (entries.length === 0) return null;

    const models = entries.map(([name]) => name);
    const p50Values = entries.map(([, d]) => d.p50);
    const p90Values = entries.map(([, d]) => d.p90);
    const p99Values = entries.map(([, d]) => d.p99);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: Array<{ seriesName: string; value: number; marker: string; axisValueLabel: string }>) => {
          const header = params[0].axisValueLabel;
          const lines = params.map(
            (p) => `${p.marker} ${p.seriesName}: ${formatLatency(p.value)}`
          );
          return `${header}<br/>${lines.join('<br/>')}`;
        },
      },
      legend: { bottom: 0, data: ['p50', 'p90', 'p99'] },
      grid: { left: 80, right: 20, top: 20, bottom: 50 },
      xAxis: {
        type: 'category' as const,
        data: models,
        axisLabel: { rotate: 15, fontSize: 11 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => formatLatency(v) },
      },
      series: [
        {
          name: 'p50',
          type: 'bar',
          data: p50Values,
          itemStyle: { color: '#10b981' },
          barGap: '10%',
        },
        {
          name: 'p90',
          type: 'bar',
          data: p90Values,
          itemStyle: { color: '#f59e0b' },
        },
        {
          name: 'p99',
          type: 'bar',
          data: p99Values,
          itemStyle: { color: '#ef4444' },
        },
      ],
    };
  }, [latencyData]);

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
