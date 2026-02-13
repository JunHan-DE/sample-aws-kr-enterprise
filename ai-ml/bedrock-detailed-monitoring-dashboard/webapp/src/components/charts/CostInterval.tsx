'use client';

import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import type { MetricDataPoint } from '@/lib/types/metrics';
import { formatCurrency, formatTimestamp } from '@/lib/utils/format';

const RANGE_MS: Record<string, number> = {
  '1h': 3_600_000,
  '6h': 21_600_000,
  '24h': 86_400_000,
  '7d': 604_800_000,
  '30d': 2_592_000_000,
};

const INTERVAL_MS: Record<string, number> = {
  minute: 60_000,
  hourly: 3_600_000,
  daily: 86_400_000,
};

function toSlotKey(date: Date, granularity: string): string {
  if (granularity === 'daily') return date.toISOString().slice(0, 10);
  if (granularity === 'hourly') return date.toISOString().slice(0, 13);
  return date.toISOString().slice(0, 16); // minute
}

function snapToInterval(date: Date, granularity: string): Date {
  const d = new Date(date);
  if (granularity === 'daily') {
    d.setUTCHours(0, 0, 0, 0);
  } else if (granularity === 'hourly') {
    d.setUTCMinutes(0, 0, 0);
  } else {
    d.setUTCSeconds(0, 0);
  }
  return d;
}

interface CostIntervalProps {
  data: MetricDataPoint[];
  timeRange?: string;
  granularity?: string;
}

export function CostInterval({ data, timeRange, granularity }: CostIntervalProps) {
  const { resolvedTheme } = useTheme();

  const option = useMemo(() => {
    const timestamps: string[] = [];
    const values: number[] = [];

    // Build cost lookup from existing data
    const costMap = new Map<string, number>();
    if (granularity) {
      for (const point of data) {
        const key = toSlotKey(new Date(point.timestamp), granularity);
        const cost = Object.values(point.cost).reduce((s, v) => s + v, 0);
        costMap.set(key, (costMap.get(key) ?? 0) + cost);
      }
    }

    // Generate full timeline with zero-fill if range/granularity available
    const rangeMs = timeRange ? RANGE_MS[timeRange] : undefined;
    const intervalMs = granularity ? INTERVAL_MS[granularity] : undefined;

    if (rangeMs && intervalMs && granularity) {
      const now = new Date();
      const start = snapToInterval(new Date(now.getTime() - rangeMs), granularity);
      const end = now;

      let current = new Date(start);
      while (current <= end) {
        const key = toSlotKey(current, granularity);
        timestamps.push(formatTimestamp(current.toISOString()));
        values.push(costMap.get(key) ?? 0);
        current = new Date(current.getTime() + intervalMs);
      }
    } else {
      // Fallback: just use data as-is (custom range or missing props)
      for (const point of data) {
        const pointCost = Object.values(point.cost).reduce((s, v) => s + v, 0);
        timestamps.push(formatTimestamp(point.timestamp));
        values.push(pointCost);
      }
      if (timestamps.length === 0) return null;
    }

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: Array<{ dataIndex: number; marker: string; value: number }>) => {
          const p = params[0];
          return `${timestamps[p.dataIndex]}<br/>${p.marker} Cost: ${formatCurrency(p.value)}`;
        },
      },
      grid: { left: 60, right: 20, top: 20, bottom: 40 },
      xAxis: {
        type: 'category' as const,
        data: timestamps,
        axisLabel: { rotate: 0, fontSize: 11, interval: 'auto' },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => formatCurrency(v) },
      },
      series: [
        {
          name: 'Cost',
          type: 'bar',
          data: values,
          itemStyle: {
            color: '#3b82f6',
            borderRadius: [2, 2, 0, 0],
          },
          emphasis: {
            itemStyle: {
              color: '#2563eb',
            },
          },
          barMaxWidth: 40,
        },
      ],
    };
  }, [data, timeRange, granularity]);

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
