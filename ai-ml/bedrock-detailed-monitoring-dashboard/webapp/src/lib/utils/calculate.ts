import type { MetricDataPoint } from '@/lib/types/metrics';

type TokenField = 'invocations' | 'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheWriteTokens' | 'cost' | 'cacheSavings' | 'latencyAvg';

export function sumByModel(
  dataPoints: MetricDataPoint[],
  field: TokenField
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const point of dataPoints) {
    const values = point[field];
    for (const [model, value] of Object.entries(values)) {
      result[model] = (result[model] ?? 0) + value;
    }
  }

  return result;
}

export function totalAll(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, val) => sum + val, 0);
}

export function calculateCacheHitRate(dataPoints: MetricDataPoint[]): number {
  const cacheReads = totalAll(sumByModel(dataPoints, 'cacheReadTokens'));
  const cacheWrites = totalAll(sumByModel(dataPoints, 'cacheWriteTokens'));
  const totalCacheTokens = cacheReads + cacheWrites;

  if (totalCacheTokens === 0) return 0;
  return (cacheReads / totalCacheTokens) * 100;
}

export function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}
