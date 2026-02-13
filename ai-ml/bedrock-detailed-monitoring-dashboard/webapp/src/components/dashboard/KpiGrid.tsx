'use client';

import { Activity, ArrowDownToLine, ArrowUpFromLine, Database, DollarSign } from 'lucide-react';
import type { MetricDataPoint } from '@/lib/types/metrics';
import { sumByModel, totalAll, calculateCacheHitRate } from '@/lib/utils/calculate';
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils/format';
import { KpiCard } from './KpiCard';

interface KpiGridProps {
  data: MetricDataPoint[];
}

export function KpiGrid({ data }: KpiGridProps) {
  const totalInvocations = totalAll(sumByModel(data, 'invocations'));
  const totalInput = totalAll(sumByModel(data, 'inputTokens'));
  const totalOutput = totalAll(sumByModel(data, 'outputTokens'));
  const cacheHitRate = calculateCacheHitRate(data);
  const totalCost = data.reduce((sum, point) => sum + totalAll(point.cost), 0);

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        title="Total Invocations"
        value={formatNumber(totalInvocations)}
        icon={<Activity className="h-4 w-4" />}
      />
      <KpiCard
        title="Input Tokens"
        value={formatNumber(totalInput)}
        icon={<ArrowDownToLine className="h-4 w-4" />}
      />
      <KpiCard
        title="Output Tokens"
        value={formatNumber(totalOutput)}
        icon={<ArrowUpFromLine className="h-4 w-4" />}
      />
      <KpiCard
        title="Cache Hit Rate"
        value={formatPercent(cacheHitRate)}
        icon={<Database className="h-4 w-4" />}
      />
      <KpiCard
        title="Total Cost"
        value={formatCurrency(totalCost)}
        icon={<DollarSign className="h-4 w-4" />}
      />
    </div>
  );
}
