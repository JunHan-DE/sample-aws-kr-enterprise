'use client';

import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import type { MetricDataPoint } from '@/lib/types/metrics';
import { MODEL_PRICING, FAMILY_COLORS } from '@/lib/constants/pricing';
import type { ModelFamily } from '@/lib/constants/pricing';
import { formatCurrency } from '@/lib/utils/format';

interface CostSankeyProps {
  data: MetricDataPoint[];
}

export function CostSankey({ data }: CostSankeyProps) {
  const { resolvedTheme } = useTheme();

  const option = useMemo(() => {
    if (data.length === 0) return null;

    // Aggregate token costs by family and token type
    const familyCosts: Record<ModelFamily, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
      opus: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      sonnet: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      haiku: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    };

    for (const point of data) {
      for (const [modelId, tokens] of Object.entries(point.inputTokens)) {
        const family = MODEL_PRICING[modelId]?.family ?? 'haiku';
        const price = MODEL_PRICING[modelId]?.input ?? 1;
        familyCosts[family].input += (tokens / 1_000_000) * price;
      }
      for (const [modelId, tokens] of Object.entries(point.outputTokens)) {
        const family = MODEL_PRICING[modelId]?.family ?? 'haiku';
        const price = MODEL_PRICING[modelId]?.output ?? 5;
        familyCosts[family].output += (tokens / 1_000_000) * price;
      }
      for (const [modelId, tokens] of Object.entries(point.cacheReadTokens)) {
        const family = MODEL_PRICING[modelId]?.family ?? 'haiku';
        const price = MODEL_PRICING[modelId]?.cacheRead ?? 0.1;
        familyCosts[family].cacheRead += (tokens / 1_000_000) * price;
      }
      for (const [modelId, tokens] of Object.entries(point.cacheWriteTokens)) {
        const family = MODEL_PRICING[modelId]?.family ?? 'haiku';
        const price = MODEL_PRICING[modelId]?.cacheWrite ?? 1.25;
        familyCosts[family].cacheWrite += (tokens / 1_000_000) * price;
      }
    }

    const nodes = [
      { name: 'Input Tokens', itemStyle: { color: '#3b82f6' } },
      { name: 'Output Tokens', itemStyle: { color: '#8b5cf6' } },
      { name: 'Cache Read', itemStyle: { color: '#10b981' } },
      { name: 'Cache Write', itemStyle: { color: '#f59e0b' } },
      { name: 'Opus', itemStyle: { color: FAMILY_COLORS.opus } },
      { name: 'Sonnet', itemStyle: { color: FAMILY_COLORS.sonnet } },
      { name: 'Haiku', itemStyle: { color: FAMILY_COLORS.haiku } },
      { name: 'Total Cost', itemStyle: { color: '#ef4444' } },
    ];

    const links: { source: string; target: string; value: number }[] = [];
    const families: ModelFamily[] = ['opus', 'sonnet', 'haiku'];
    const familyLabels: Record<ModelFamily, string> = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' };

    for (const family of families) {
      const c = familyCosts[family];
      const label = familyLabels[family];
      if (c.input > 0) links.push({ source: 'Input Tokens', target: label, value: c.input });
      if (c.output > 0) links.push({ source: 'Output Tokens', target: label, value: c.output });
      if (c.cacheRead > 0) links.push({ source: 'Cache Read', target: label, value: c.cacheRead });
      if (c.cacheWrite > 0) links.push({ source: 'Cache Write', target: label, value: c.cacheWrite });

      const total = c.input + c.output + c.cacheRead + c.cacheWrite;
      if (total > 0) links.push({ source: label, target: 'Total Cost', value: total });
    }

    if (links.length === 0) return null;

    return {
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: (params: { data: { source?: string; target?: string; value?: number }; name?: string }) => {
          if (params.data.source) {
            return `${params.data.source} → ${params.data.target}<br/>Cost: ${formatCurrency(params.data.value ?? 0)}`;
          }
          return params.name ?? '';
        },
      },
      series: [
        {
          type: 'sankey',
          layout: 'none',
          emphasis: { focus: 'adjacency' },
          nodeAlign: 'justify',
          data: nodes,
          links,
          lineStyle: { color: 'gradient', curveness: 0.5 },
          label: { fontSize: 12 },
        },
      ],
    };
  }, [data]);

  if (data.length === 0 || !option) {
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
