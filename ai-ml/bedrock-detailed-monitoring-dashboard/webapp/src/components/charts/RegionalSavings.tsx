'use client';

import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import { MODEL_PRICING } from '@/lib/constants/pricing';
import { formatCurrency } from '@/lib/utils/format';
import type { MetricDataPoint } from '@/lib/types/metrics';

interface RegionalSavingsProps {
  data: MetricDataPoint[];
}

interface RegionalModelCost {
  modelId: string;
  name: string;
  actualCost: number;
  globalEquivalentCost: number;
  premium: number;
}

/**
 * Find the global equivalent model ID for a regional (us.) model.
 * Matches by replacing the region prefix (us. -> global.) and looking up in MODEL_PRICING.
 * Returns null if no exact global equivalent exists -- we do not fall back to
 * family matching because that could pair different model generations (e.g.,
 * Haiku 3.5 US with Haiku 4.5 Global), producing misleading cost comparisons.
 */
function findGlobalEquivalent(regionalModelId: string): string | null {
  const globalCandidate = regionalModelId.replace(/^us\./, 'global.');
  if (MODEL_PRICING[globalCandidate]) {
    return globalCandidate;
  }
  return null;
}

export function RegionalSavings({ data }: RegionalSavingsProps) {
  const { resolvedTheme } = useTheme();

  const regionalModels = useMemo(() => {
    const costByModel: Record<string, number> = {};
    const inputTokensByModel: Record<string, number> = {};
    const outputTokensByModel: Record<string, number> = {};
    const cacheReadByModel: Record<string, number> = {};
    const cacheWriteByModel: Record<string, number> = {};

    for (const point of data) {
      for (const [model, value] of Object.entries(point.cost)) {
        costByModel[model] = (costByModel[model] ?? 0) + value;
      }
      for (const [model, value] of Object.entries(point.inputTokens)) {
        inputTokensByModel[model] = (inputTokensByModel[model] ?? 0) + value;
      }
      for (const [model, value] of Object.entries(point.outputTokens)) {
        outputTokensByModel[model] = (outputTokensByModel[model] ?? 0) + value;
      }
      for (const [model, value] of Object.entries(point.cacheReadTokens)) {
        cacheReadByModel[model] = (cacheReadByModel[model] ?? 0) + value;
      }
      for (const [model, value] of Object.entries(point.cacheWriteTokens)) {
        cacheWriteByModel[model] = (cacheWriteByModel[model] ?? 0) + value;
      }
    }

    const results: RegionalModelCost[] = [];

    for (const [modelId, actualCost] of Object.entries(costByModel)) {
      if (!modelId.startsWith('us.')) continue;
      if (actualCost <= 0) continue;

      const globalId = findGlobalEquivalent(modelId);
      if (!globalId) continue;

      const globalPricing = MODEL_PRICING[globalId];
      if (!globalPricing) continue;

      const inputTokens = inputTokensByModel[modelId] ?? 0;
      const outputTokens = outputTokensByModel[modelId] ?? 0;
      const cacheReadTokens = cacheReadByModel[modelId] ?? 0;
      const cacheWriteTokens = cacheWriteByModel[modelId] ?? 0;

      const globalEquivalentCost =
        (inputTokens / 1_000_000) * globalPricing.input +
        (outputTokens / 1_000_000) * globalPricing.output +
        (cacheReadTokens / 1_000_000) * globalPricing.cacheRead +
        (cacheWriteTokens / 1_000_000) * globalPricing.cacheWrite;

      const premium = actualCost - globalEquivalentCost;
      if (premium <= 0) continue;

      const pricing = MODEL_PRICING[modelId];
      const name = pricing?.shortName ?? modelId;

      results.push({ modelId, name, actualCost, globalEquivalentCost, premium });
    }

    return results.sort((a, b) => b.premium - a.premium);
  }, [data]);

  const totalPremium = useMemo(
    () => regionalModels.reduce((sum, m) => sum + m.premium, 0),
    [regionalModels]
  );

  const option = useMemo(() => {
    if (regionalModels.length === 0) return null;

    const models = regionalModels.map((m) => m.name);
    const globalCosts = regionalModels.map((m) => m.globalEquivalentCost);
    const premiums = regionalModels.map((m) => m.premium);

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: Array<{ marker: string; seriesName: string; value: number; dataIndex: number }>) => {
          const idx = params[0].dataIndex;
          const model = regionalModels[idx];
          const lines = params.map(
            (p) => `${p.marker} ${p.seriesName}: ${formatCurrency(p.value)}`
          );
          return [
            `<b>${model.name}</b>`,
            ...lines,
            `<br/><b>Total Regional Cost: ${formatCurrency(model.actualCost)}</b>`,
            `<b>Potential Savings: ${formatCurrency(model.premium)}</b>`,
          ].join('<br/>');
        },
      },
      legend: {
        bottom: 0,
        data: ['Global Equivalent', 'Regional Premium'],
      },
      grid: { left: 120, right: 40, top: 30, bottom: 50 },
      yAxis: {
        type: 'category' as const,
        data: models,
        axisLabel: { fontSize: 11 },
        inverse: true,
      },
      xAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => formatCurrency(v) },
      },
      series: [
        {
          name: 'Global Equivalent',
          type: 'bar',
          stack: 'cost',
          data: globalCosts,
          itemStyle: { color: '#10b981' },
          barMaxWidth: 40,
        },
        {
          name: 'Regional Premium',
          type: 'bar',
          stack: 'cost',
          data: premiums,
          itemStyle: { color: '#f97316' },
          barMaxWidth: 40,
          label: {
            show: true,
            position: 'right' as const,
            formatter: (params: { dataIndex: number }) => {
              const p = premiums[params.dataIndex];
              return p > 0 ? `+${formatCurrency(p)}` : '';
            },
            fontSize: 11,
            color: '#f97316',
          },
        },
      ],
      graphic: totalPremium > 0
        ? [
            {
              type: 'text',
              right: 10,
              top: 5,
              style: {
                text: `Total potential savings: ${formatCurrency(totalPremium)}`,
                fontSize: 12,
                fontWeight: 'bold' as const,
                fill: '#f97316',
              },
            },
          ]
        : [],
    };
  }, [regionalModels, totalPremium]);

  if (regionalModels.length === 0 || !option) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground">
        No regional usage detected — all traffic uses global inference endpoints
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
