import { NextRequest, NextResponse } from 'next/server';
import { queryMetricsByTimeRange } from '@/lib/db/metrics-repository';
import { sumByModel } from '@/lib/utils/calculate';
import type { TimeRange, MetricGranularity } from '@/lib/types/metrics';

const VALID_RANGES: Set<string> = new Set(['1h', '6h', '24h', '7d', '30d', 'custom']);

const AUTO_GRANULARITY: Record<Exclude<TimeRange, 'custom'>, MetricGranularity> = {
  '1h': 'minute',
  '6h': 'minute',
  '24h': 'hourly',
  '7d': 'daily',
  '30d': 'daily',
};

const RANGE_SECONDS: Record<Exclude<TimeRange, 'custom'>, number> = {
  '1h': 3600,
  '6h': 21600,
  '24h': 86400,
  '7d': 604800,
  '30d': 2592000,
};

function autoGranularityForDuration(durationMs: number): MetricGranularity {
  const hours = durationMs / (1000 * 60 * 60);
  if (hours <= 6) return 'minute';
  const days = hours / 24;
  if (days <= 3) return 'hourly';
  return 'daily';
}

interface ModelStats {
  modelId: string;
  totalCost: number;
  totalTokens: number;
  avgLatency: number;
  invocations: number;
  cacheHitRate: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const range = searchParams.get('range') ?? '24h';

    if (!VALID_RANGES.has(range)) {
      return NextResponse.json(
        { error: `Invalid range: ${range}. Must be one of: 1h, 6h, 24h, 7d, 30d, custom` },
        { status: 400 }
      );
    }

    const timeRange = range as TimeRange;
    let startTime: Date;
    let endTime: Date;
    let granularity: MetricGranularity;

    if (timeRange === 'custom') {
      const startParam = searchParams.get('start');
      const endParam = searchParams.get('end');

      if (!startParam || !endParam) {
        return NextResponse.json(
          { error: 'Custom range requires start and end parameters' },
          { status: 400 }
        );
      }

      startTime = new Date(startParam);
      endTime = new Date(endParam);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return NextResponse.json(
          { error: 'Invalid start or end date format' },
          { status: 400 }
        );
      }

      if (endParam.length === 10) {
        endTime = new Date(endParam + 'T23:59:59.999Z');
      }

      if (startTime >= endTime) {
        return NextResponse.json(
          { error: 'Start date must be before end date' },
          { status: 400 }
        );
      }

      granularity = autoGranularityForDuration(endTime.getTime() - startTime.getTime());
    } else {
      endTime = new Date();
      startTime = new Date(endTime.getTime() - RANGE_SECONDS[timeRange] * 1000);
      granularity = AUTO_GRANULARITY[timeRange];
    }

    const dataPoints = await queryMetricsByTimeRange(
      granularity,
      startTime.toISOString(),
      endTime.toISOString()
    );

    // Aggregate per-model stats
    const costByModel = sumByModel(dataPoints, 'cost');
    const invocationsByModel = sumByModel(dataPoints, 'invocations');
    const inputByModel = sumByModel(dataPoints, 'inputTokens');
    const outputByModel = sumByModel(dataPoints, 'outputTokens');
    const cacheReadByModel = sumByModel(dataPoints, 'cacheReadTokens');
    const cacheWriteByModel = sumByModel(dataPoints, 'cacheWriteTokens');
    const latencyByModel = sumByModel(dataPoints, 'latencyAvg');

    // Collect all model IDs that appear in any metric
    const allModelIds = new Set<string>();
    for (const record of [costByModel, invocationsByModel, inputByModel, outputByModel, cacheReadByModel, cacheWriteByModel, latencyByModel]) {
      for (const id of Object.keys(record)) {
        allModelIds.add(id);
      }
    }

    const models: ModelStats[] = [];
    for (const modelId of allModelIds) {
      const invocations = invocationsByModel[modelId] ?? 0;
      const input = inputByModel[modelId] ?? 0;
      const output = outputByModel[modelId] ?? 0;
      const cacheRead = cacheReadByModel[modelId] ?? 0;
      const cacheWrite = cacheWriteByModel[modelId] ?? 0;
      const totalTokens = input + output + cacheRead + cacheWrite;

      // Average latency: latencyByModel accumulates sum of averages,
      // divide by number of data points that had this model
      const latencySum = latencyByModel[modelId] ?? 0;
      let latencyCount = 0;
      for (const point of dataPoints) {
        if (point.latencyAvg[modelId] !== undefined && point.latencyAvg[modelId] > 0) {
          latencyCount++;
        }
      }
      const avgLatency = latencyCount > 0 ? latencySum / latencyCount : 0;

      // Cache hit rate: cacheRead / (cacheRead + cacheWrite)
      const totalCache = cacheRead + cacheWrite;
      const cacheHitRate = totalCache > 0 ? (cacheRead / totalCache) * 100 : 0;

      models.push({
        modelId,
        totalCost: parseFloat((costByModel[modelId] ?? 0).toFixed(6)),
        totalTokens,
        avgLatency: parseFloat(avgLatency.toFixed(2)),
        invocations,
        cacheHitRate: parseFloat(cacheHitRate.toFixed(2)),
      });
    }

    // Sort by cost descending
    models.sort((a, b) => b.totalCost - a.totalCost);

    return NextResponse.json({ models, timeRange: range });
  } catch (error) {
    console.error('Failed to fetch model stats:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch model stats' },
      { status: 500 }
    );
  }
}
