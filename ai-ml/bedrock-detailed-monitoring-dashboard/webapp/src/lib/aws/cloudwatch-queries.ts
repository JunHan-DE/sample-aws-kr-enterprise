import {
  GetMetricDataCommand,
  MetricDataResult,
  type MetricDataQuery,
} from '@aws-sdk/client-cloudwatch';
import { getCloudWatchClient } from './cloudwatch-client';
import {
  MODEL_IDS,
  buildAllModelQueries,
  buildLatencyQueriesForModel,
  buildErrorQueries,
} from './metric-definitions';
import type { MetricDataPoint, TimeRange } from '@/lib/types/metrics';
import { MODEL_PRICING } from '@/lib/constants/pricing';

const TIME_RANGE_CONFIG: Record<Exclude<TimeRange, 'custom'>, { seconds: number; period: number }> = {
  '1h': { seconds: 3600, period: 60 },
  '6h': { seconds: 21600, period: 300 },
  '24h': { seconds: 86400, period: 900 },
  '7d': { seconds: 604800, period: 3600 },
  '30d': { seconds: 2592000, period: 86400 },
};

/** Maximum metric data queries per GetMetricData call */
const MAX_QUERIES_PER_CALL = 500;

/**
 * Execute GetMetricData with automatic pagination for large query sets.
 * CloudWatch limits queries to 500 per call.
 */
async function executeMetricDataQueries(
  queries: MetricDataQuery[],
  startTime: Date,
  endTime: Date
): Promise<MetricDataResult[]> {
  const client = getCloudWatchClient();
  const results: MetricDataResult[] = [];

  // Split queries into batches of MAX_QUERIES_PER_CALL
  for (let i = 0; i < queries.length; i += MAX_QUERIES_PER_CALL) {
    const batch = queries.slice(i, i + MAX_QUERIES_PER_CALL);

    let nextToken: string | undefined;
    do {
      const command = new GetMetricDataCommand({
        MetricDataQueries: batch,
        StartTime: startTime,
        EndTime: endTime,
        NextToken: nextToken,
      });

      const response = await client.send(command);
      if (response.MetricDataResults) {
        results.push(...response.MetricDataResults);
      }
      nextToken = response.NextToken;
    } while (nextToken);
  }

  return results;
}

/**
 * Get the value at a specific timestamp from a MetricDataResult.
 */
function getValueAtTimestamp(result: MetricDataResult | undefined, tsMs: number): number {
  if (!result?.Timestamps || !result?.Values) return 0;
  const idx = result.Timestamps.findIndex((t) => t.getTime() === tsMs);
  return idx >= 0 ? (result.Values[idx] ?? 0) : 0;
}

/**
 * Get real-time usage metrics directly from CloudWatch.
 * Returns time-series data points with per-model token counts, cost, and latency.
 * All numeric fields are Record<string, number> keyed by model ID.
 * Pricing is per MTok (per 1M tokens).
 */
export async function getRealtimeMetrics(
  timeRange: Exclude<TimeRange, 'custom'>
): Promise<MetricDataPoint[]> {
  const config = TIME_RANGE_CONFIG[timeRange];
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - config.seconds * 1000);

  const queries = buildAllModelQueries(config.period);
  const results = await executeMetricDataQueries(queries, startTime, endTime);

  // Build a map: queryId -> MetricDataResult for fast lookup
  const resultMap = new Map<string, MetricDataResult>();
  for (const result of results) {
    if (result.Id) {
      resultMap.set(result.Id, result);
    }
  }

  // Collect all unique timestamps across all results
  const timestampSet = new Set<number>();
  for (const result of results) {
    if (result.Timestamps) {
      for (const ts of result.Timestamps) {
        timestampSet.add(ts.getTime());
      }
    }
  }

  const timestamps = Array.from(timestampSet).sort((a, b) => a - b);

  // For each timestamp, build per-model breakdowns
  const dataPoints: MetricDataPoint[] = timestamps.map((tsMs) => {
    const invocations: Record<string, number> = {};
    const inputTokens: Record<string, number> = {};
    const outputTokens: Record<string, number> = {};
    const cacheReadTokens: Record<string, number> = {};
    const cacheWriteTokens: Record<string, number> = {};
    const cost: Record<string, number> = {};
    const cacheSavings: Record<string, number> = {};
    const latencyAvg: Record<string, number> = {};

    for (let modelIdx = 0; modelIdx < MODEL_IDS.length; modelIdx++) {
      const modelId = MODEL_IDS[modelIdx];
      const pricing = MODEL_PRICING[modelId];

      const prefix = `m${modelIdx}`;
      const inv = getValueAtTimestamp(resultMap.get(`${prefix}_invocations_sum`), tsMs);
      const inp = getValueAtTimestamp(resultMap.get(`${prefix}_input_token_count_sum`), tsMs);
      const out = getValueAtTimestamp(resultMap.get(`${prefix}_output_token_count_sum`), tsMs);
      const cRead = getValueAtTimestamp(resultMap.get(`${prefix}_cache_read_input_token_count_sum`), tsMs);
      const cWrite = getValueAtTimestamp(resultMap.get(`${prefix}_cache_write_input_token_count_sum`), tsMs);
      const lat = getValueAtTimestamp(resultMap.get(`${prefix}_invocation_latency_average`), tsMs);

      // Skip models with no data at this timestamp
      if (inv === 0 && inp === 0 && out === 0 && lat === 0) continue;

      invocations[modelId] = inv;
      inputTokens[modelId] = inp;
      outputTokens[modelId] = out;
      cacheReadTokens[modelId] = cRead;
      cacheWriteTokens[modelId] = cWrite;
      latencyAvg[modelId] = lat;

      if (pricing) {
        // Pricing is per MTok (per 1,000,000 tokens)
        const inputCost = (inp / 1_000_000) * pricing.input;
        const outputCost = (out / 1_000_000) * pricing.output;
        const cacheReadCost = (cRead / 1_000_000) * pricing.cacheRead;
        const cacheWriteCost = (cWrite / 1_000_000) * pricing.cacheWrite;
        const totalCost = inputCost + outputCost + cacheReadCost + cacheWriteCost;
        cost[modelId] = parseFloat(totalCost.toFixed(6));

        // Cache savings: difference between full input price and discounted cache read price
        const savings = (cRead / 1_000_000) * (pricing.input - pricing.cacheRead);
        cacheSavings[modelId] = parseFloat(Math.max(0, savings).toFixed(6));
      } else {
        cost[modelId] = 0;
        cacheSavings[modelId] = 0;
      }
    }

    return {
      timestamp: new Date(tsMs).toISOString(),
      invocations,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      cost,
      cacheSavings,
      latencyAvg,
    };
  });

  return dataPoints;
}

/** Latency data point for a single model at a single timestamp */
export interface LatencyDataPoint {
  timestamp: string;
  modelId: string;
  average: number;
  p50: number;
  p90: number;
  p99: number;
}

/**
 * Get real-time latency metrics from CloudWatch.
 * Returns per-model latency percentiles over time.
 */
export async function getRealtimeLatency(
  timeRange: Exclude<TimeRange, 'custom'>
): Promise<LatencyDataPoint[]> {
  const config = TIME_RANGE_CONFIG[timeRange];
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - config.seconds * 1000);

  // Build latency queries for all models
  const queries = MODEL_IDS.flatMap((modelId, index) =>
    buildLatencyQueriesForModel(modelId, index, config.period)
  );

  const results = await executeMetricDataQueries(queries, startTime, endTime);

  const resultMap = new Map<string, MetricDataResult>();
  for (const result of results) {
    if (result.Id) {
      resultMap.set(result.Id, result);
    }
  }

  const dataPoints: LatencyDataPoint[] = [];

  for (let modelIdx = 0; modelIdx < MODEL_IDS.length; modelIdx++) {
    const modelId = MODEL_IDS[modelIdx];
    const prefix = `m${modelIdx}_invocation_latency`;

    const avgResult = resultMap.get(`${prefix}_average`);
    if (!avgResult?.Timestamps?.length) continue;

    for (let i = 0; i < avgResult.Timestamps.length; i++) {
      const ts = avgResult.Timestamps[i];

      const getVal = (statKey: string, idx: number): number => {
        const res = resultMap.get(`${prefix}_${statKey}`);
        return res?.Values?.[idx] ?? 0;
      };

      dataPoints.push({
        timestamp: ts.toISOString(),
        modelId,
        average: getVal('average', i),
        p50: getVal('p50', i),
        p90: getVal('p90', i),
        p99: getVal('p99', i),
      });
    }
  }

  dataPoints.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return dataPoints;
}

/** Error/throttle data point for a single model at a single timestamp */
export interface ErrorDataPoint {
  timestamp: string;
  modelId: string;
  clientErrors: number;
  serverErrors: number;
  throttles: number;
}

/**
 * Get real-time error and throttle metrics from CloudWatch.
 * Returns per-model error counts over time.
 */
export async function getRealtimeErrors(
  timeRange: Exclude<TimeRange, 'custom'>
): Promise<ErrorDataPoint[]> {
  const config = TIME_RANGE_CONFIG[timeRange];
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - config.seconds * 1000);

  const queries = buildErrorQueries(config.period);
  const results = await executeMetricDataQueries(queries, startTime, endTime);

  const resultMap = new Map<string, MetricDataResult>();
  for (const result of results) {
    if (result.Id) {
      resultMap.set(result.Id, result);
    }
  }

  const dataPoints: ErrorDataPoint[] = [];

  for (let modelIdx = 0; modelIdx < MODEL_IDS.length; modelIdx++) {
    const modelId = MODEL_IDS[modelIdx];
    const prefix = `m${modelIdx}`;

    const clientErrResult = resultMap.get(`${prefix}_invocation_client_errors_sum`);
    const serverErrResult = resultMap.get(`${prefix}_invocation_server_errors_sum`);
    const throttleResult = resultMap.get(`${prefix}_invocation_throttles_sum`);

    // Collect all timestamps across error metrics for this model
    const tsSet = new Set<number>();
    for (const res of [clientErrResult, serverErrResult, throttleResult]) {
      if (res?.Timestamps) {
        for (const t of res.Timestamps) {
          tsSet.add(t.getTime());
        }
      }
    }

    for (const tsMs of tsSet) {
      dataPoints.push({
        timestamp: new Date(tsMs).toISOString(),
        modelId,
        clientErrors: getValueAtTimestamp(clientErrResult, tsMs),
        serverErrors: getValueAtTimestamp(serverErrResult, tsMs),
        throttles: getValueAtTimestamp(throttleResult, tsMs),
      });
    }
  }

  dataPoints.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return dataPoints;
}
