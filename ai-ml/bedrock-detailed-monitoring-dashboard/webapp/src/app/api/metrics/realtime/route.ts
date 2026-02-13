import { NextRequest, NextResponse } from 'next/server';
import { getRealtimeMetrics } from '@/lib/aws/cloudwatch-queries';
import type { TimeRange } from '@/lib/types/metrics';

const VALID_RANGES: Set<string> = new Set(['1h', '6h', '24h', '7d', '30d']);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const range = searchParams.get('range') ?? '1h';

    if (!VALID_RANGES.has(range)) {
      return NextResponse.json(
        { error: `Invalid range: ${range}. Must be one of: 1h, 6h, 24h, 7d, 30d` },
        { status: 400 }
      );
    }

    const data = await getRealtimeMetrics(range as Exclude<TimeRange, 'custom'>);

    return NextResponse.json({ data, timeRange: range });
  } catch (error) {
    console.error('Failed to fetch realtime metrics:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch realtime metrics' },
      { status: 500 }
    );
  }
}
