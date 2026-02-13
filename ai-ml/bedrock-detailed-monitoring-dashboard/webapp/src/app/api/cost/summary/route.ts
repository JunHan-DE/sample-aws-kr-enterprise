import { NextRequest, NextResponse } from 'next/server';
import { getCumulativeSummary } from '@/lib/db/metrics-repository';

const MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const month = searchParams.get('month') ?? undefined;

    if (month && !MONTH_PATTERN.test(month)) {
      return NextResponse.json(
        { error: `Invalid month format: ${month}. Must be YYYY-MM` },
        { status: 400 }
      );
    }

    const summary = await getCumulativeSummary(month);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Failed to fetch cost summary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch cost summary' },
      { status: 500 }
    );
  }
}
