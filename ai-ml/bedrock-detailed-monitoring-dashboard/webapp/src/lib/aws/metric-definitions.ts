import type { MetricDataQuery, MetricStat } from '@aws-sdk/client-cloudwatch';

export const BEDROCK_NAMESPACE = 'AWS/Bedrock';
export const DIMENSION_NAME = 'ModelId';

export const MODEL_IDS = [
  'global.anthropic.claude-opus-4-6-v1',
  'global.anthropic.claude-opus-4-5-20251101-v1:0',
  'us.anthropic.claude-opus-4-5-20251101-v1:0',
  'global.anthropic.claude-sonnet-4-6',
  'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'global.anthropic.claude-haiku-4-5-20251001-v1:0',
  'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  'us.anthropic.claude-3-5-haiku-20241022-v1:0',
] as const;

export const METRIC_NAMES = {
  INVOCATIONS: 'Invocations',
  INPUT_TOKENS: 'InputTokenCount',
  OUTPUT_TOKENS: 'OutputTokenCount',
  CACHE_READ: 'CacheReadInputTokenCount',
  CACHE_WRITE: 'CacheWriteInputTokenCount',
  LATENCY: 'InvocationLatency',
  CLIENT_ERRORS: 'InvocationClientErrors',
  SERVER_ERRORS: 'InvocationServerErrors',
  THROTTLES: 'InvocationThrottles',
} as const;

/**
 * Generate a CloudWatch-safe metric query ID from model index, metric, and stat.
 * CloudWatch requires IDs matching [a-z][a-zA-Z0-9_]*.
 */
function safeId(modelIndex: number, metric: string, stat: string): string {
  const safeStat = stat.toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeMetric = metric
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/[^a-z0-9_]/g, '');
  return `m${modelIndex}_${safeMetric}_${safeStat}`;
}

/**
 * Build a single MetricDataQuery for a specific model and metric.
 */
export function buildMetricQuery(
  modelId: string,
  metricName: string,
  stat: string,
  period: number,
  id: string
): MetricDataQuery {
  const metricStat: MetricStat = {
    Metric: {
      Namespace: BEDROCK_NAMESPACE,
      MetricName: metricName,
      Dimensions: [
        {
          Name: DIMENSION_NAME,
          Value: modelId,
        },
      ],
    },
    Period: period,
    Stat: stat,
  };

  return {
    Id: id,
    MetricStat: metricStat,
    ReturnData: true,
  };
}

/**
 * Build queries for all token metrics (input, output, cache read, cache write),
 * invocations, and average latency for a single model.
 */
export function buildTokenQueriesForModel(
  modelId: string,
  modelIndex: number,
  period: number
): MetricDataQuery[] {
  const metrics = [
    { name: METRIC_NAMES.INVOCATIONS, stat: 'Sum' },
    { name: METRIC_NAMES.INPUT_TOKENS, stat: 'Sum' },
    { name: METRIC_NAMES.OUTPUT_TOKENS, stat: 'Sum' },
    { name: METRIC_NAMES.CACHE_READ, stat: 'Sum' },
    { name: METRIC_NAMES.CACHE_WRITE, stat: 'Sum' },
    { name: METRIC_NAMES.LATENCY, stat: 'Average' },
  ];

  return metrics.map(({ name, stat }) =>
    buildMetricQuery(
      modelId,
      name,
      stat,
      period,
      safeId(modelIndex, name, stat)
    )
  );
}

/**
 * Build queries for ALL models and ALL token metrics.
 */
export function buildAllModelQueries(period: number): MetricDataQuery[] {
  const queries: MetricDataQuery[] = [];
  MODEL_IDS.forEach((modelId, index) => {
    queries.push(...buildTokenQueriesForModel(modelId, index, period));
  });
  return queries;
}

/**
 * Build latency queries (Average, p50, p90, p99) for a single model.
 */
export function buildLatencyQueriesForModel(
  modelId: string,
  modelIndex: number,
  period: number
): MetricDataQuery[] {
  const stats = ['Average', 'p50', 'p90', 'p99'];
  return stats.map((stat) =>
    buildMetricQuery(
      modelId,
      METRIC_NAMES.LATENCY,
      stat,
      period,
      safeId(modelIndex, METRIC_NAMES.LATENCY, stat)
    )
  );
}

/**
 * Build error and throttle queries for all models.
 */
export function buildErrorQueries(period: number): MetricDataQuery[] {
  const errorMetrics = [
    METRIC_NAMES.CLIENT_ERRORS,
    METRIC_NAMES.SERVER_ERRORS,
    METRIC_NAMES.THROTTLES,
  ];

  const queries: MetricDataQuery[] = [];
  MODEL_IDS.forEach((modelId, index) => {
    errorMetrics.forEach((metricName) => {
      queries.push(
        buildMetricQuery(
          modelId,
          metricName,
          'Sum',
          period,
          safeId(index, metricName, 'Sum')
        )
      );
    });
  });
  return queries;
}
