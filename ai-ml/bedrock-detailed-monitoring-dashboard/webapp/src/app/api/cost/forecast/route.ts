import { NextResponse } from 'next/server';
import { getCumulativeSummary, queryMetricsByTimeRange } from '@/lib/db/metrics-repository';
import type { CostForecast } from '@/lib/types/metrics';
import { totalAll, sumByModel } from '@/lib/utils/calculate';

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export async function GET() {
  try {
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const summary = await getCumulativeSummary(currentMonth);

    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1; // 1-indexed
    const totalDays = daysInMonth(year, month);
    const daysElapsed = now.getUTCDate();

    const currentCost = summary.totalCost;
    const dailyAverage = daysElapsed > 0 ? currentCost / daysElapsed : 0;
    const projectedMonthEnd = dailyAverage * totalDays;

    // Determine trend by comparing last 7 days vs previous 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);

    const [recentData, previousData] = await Promise.all([
      queryMetricsByTimeRange('daily', sevenDaysAgo.toISOString(), now.toISOString()),
      queryMetricsByTimeRange('daily', fourteenDaysAgo.toISOString(), sevenDaysAgo.toISOString()),
    ]);

    const recentCost = totalAll(sumByModel(recentData, 'cost'));
    const previousCost = totalAll(sumByModel(previousData, 'cost'));

    let trend: CostForecast['trend'] = 'stable';
    if (previousCost > 0) {
      const changePercent = ((recentCost - previousCost) / previousCost) * 100;
      if (changePercent > 10) {
        trend = 'increasing';
      } else if (changePercent < -10) {
        trend = 'decreasing';
      }
    } else if (recentCost > 0) {
      trend = 'increasing';
    }

    const forecast: CostForecast = {
      currentCost,
      projectedMonthEnd: parseFloat(projectedMonthEnd.toFixed(2)),
      daysElapsed,
      daysInMonth: totalDays,
      dailyAverage: parseFloat(dailyAverage.toFixed(2)),
      trend,
    };

    return NextResponse.json(forecast);
  } catch (error) {
    console.error('Failed to calculate cost forecast:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate cost forecast' },
      { status: 500 }
    );
  }
}
