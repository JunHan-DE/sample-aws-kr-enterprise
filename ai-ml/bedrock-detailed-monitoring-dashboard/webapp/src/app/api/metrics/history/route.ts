import { NextRequest, NextResponse } from 'next/server';
import { queryMetricsByTimeRange } from '@/lib/db/metrics-repository';
import type { TimeRange, MetricGranularity } from '@/lib/types/metrics';

const VALID_RANGES: Set<string> = new Set(['1h', '6h', '24h', '7d', '30d', 'custom']);
const VALID_GRANULARITIES: Set<string> = new Set(['minute', 'hourly', 'daily']);

const AUTO_GRANULARITY: Record<Exclude<TimeRange, 'custom'>, MetricGranularity> = {
  '1h': 'minute',
  '6h': 'hourly',
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const range = searchParams.get('range') ?? '1h';

    if (!VALID_RANGES.has(range)) {
      return NextResponse.json(
        { error: `Invalid range: ${range}. Must be one of: 1h, 6h, 24h, 7d, 30d, custom` },
        { status: 400 }
      );
    }

    const timeRange = range as TimeRange;
    let granularity = searchParams.get('granularity');

    if (granularity && !VALID_GRANULARITIES.has(granularity)) {
      return NextResponse.json(
        { error: `Invalid granularity: ${granularity}. Must be one of: minute, hourly, daily` },
        { status: 400 }
      );
    }

    let startTime: Date;
    let endTime: Date;

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

      // Set end to end-of-day if only date was provided (no time component)
      if (endParam.length === 10) {
        endTime = new Date(endParam + 'T23:59:59.999Z');
      }

      if (startTime >= endTime) {
        return NextResponse.json(
          { error: 'Start date must be before end date' },
          { status: 400 }
        );
      }
    } else {
      endTime = new Date();
      startTime = new Date(endTime.getTime() - RANGE_SECONDS[timeRange] * 1000);
    }

    const resolvedGranularity: MetricGranularity = granularity
      ? (granularity as MetricGranularity)
      : timeRange === 'custom'
        ? autoGranularityForDuration(endTime.getTime() - startTime.getTime())
        : AUTO_GRANULARITY[timeRange];

    const data = await queryMetricsByTimeRange(
      resolvedGranularity,
      startTime.toISOString(),
      endTime.toISOString()
    );

    return NextResponse.json({
      data,
      granularity: resolvedGranularity,
      timeRange: range,
    });
  } catch (error) {
    console.error('Failed to fetch metric history:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch metric history' },
      { status: 500 }
    );
  }
}
