'use client';

import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import type { MetricDataPoint } from '@/lib/types/metrics';

interface MetricsHistoryResponse {
  data: MetricDataPoint[];
  granularity: string;
  timeRange: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}:00`);

export function UsageHeatmap() {
  const { resolvedTheme } = useTheme();

  const { data: response, isLoading } = useQuery({
    queryKey: ['metrics', 'heatmap'],
    queryFn: () =>
      fetchApi<MetricsHistoryResponse>('/api/metrics/history', {
        range: '7d',
        granularity: 'hourly',
      }),
  });

  const metrics = response?.data ?? [];

  const option = useMemo(() => {
    if (metrics.length === 0) return null;

    // Build a 7x24 matrix: [dayOfWeek][hour] = total invocations
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

    for (const point of metrics) {
      const date = new Date(point.timestamp);
      // getDay: 0=Sun, convert to Mon=0 ... Sun=6
      const dayIdx = (date.getDay() + 6) % 7;
      const hour = date.getHours();
      const total = Object.values(point.invocations).reduce((s, v) => s + v, 0);
      matrix[dayIdx][hour] += total;
    }

    // ECharts heatmap data: [x(hour), y(day), value]
    const heatmapData: [number, number, number][] = [];
    let maxVal = 0;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        heatmapData.push([h, d, matrix[d][h]]);
        if (matrix[d][h] > maxVal) maxVal = matrix[d][h];
      }
    }

    const isDark = resolvedTheme === 'dark';

    return {
      tooltip: {
        position: 'top',
        formatter: (params: { value: [number, number, number] }) => {
          const [hour, day, val] = params.value;
          return `${DAYS[day]} ${HOURS[hour]}<br/>Invocations: ${val}`;
        },
      },
      grid: { left: 60, right: 40, top: 10, bottom: 80 },
      xAxis: {
        type: 'category' as const,
        data: HOURS,
        splitArea: { show: true },
      },
      yAxis: {
        type: 'category' as const,
        data: DAYS,
        splitArea: { show: true },
      },
      visualMap: {
        min: 0,
        max: maxVal || 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        splitNumber: 5,
        inRange: {
          color: isDark
            ? ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']
            : ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
        },
      },
      series: [
        {
          type: 'heatmap',
          data: heatmapData,
          label: { show: false },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' },
          },
        },
      ],
    };
  }, [metrics, resolvedTheme]);

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (metrics.length === 0 || !option) {
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
