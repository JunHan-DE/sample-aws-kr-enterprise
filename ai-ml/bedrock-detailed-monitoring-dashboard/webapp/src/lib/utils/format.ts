import type { MetricGranularity } from '@/lib/types/metrics';

export function formatCurrency(value: number): string {
  if (value < 0.01 && value > 0) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.round(ms)}ms`;
}

export function formatTimestamp(iso: string, granularity?: MetricGranularity): string {
  const date = new Date(iso);
  const M = date.getMonth() + 1;
  const D = date.getDate();
  const HH = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');

  switch (granularity) {
    case 'minute':
      return `${HH}:${mm}`;
    case 'hourly':
      return `${M}/${D} ${date.getHours()}시`;
    case 'daily':
      return `${M}/${D}`;
    default:
      return `${M}/${D} ${HH}:${mm}`;
  }
}
