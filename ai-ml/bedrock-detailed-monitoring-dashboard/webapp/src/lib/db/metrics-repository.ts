import { QueryCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { MetricDataPoint, CostSummary, ModelCostDetail, Settings, MetricGranularity } from '@/lib/types/metrics';
import { docClient } from './dynamodb-client';
import { TABLE_NAME, PK, SK } from './schema';
import { MODEL_PRICING } from '@/lib/constants/pricing';

const DEFAULT_PRICING: Settings['pricing'] = Object.fromEntries(
  Object.entries(MODEL_PRICING).map(([modelId, p]) => [
    modelId,
    { input: p.input, output: p.output, cacheWrite: p.cacheWrite, cacheRead: p.cacheRead },
  ])
);

const GRANULARITY_TO_PK: Record<MetricGranularity, string> = {
  minute: PK.MINUTE,
  hourly: PK.HOURLY,
  daily: PK.DAILY,
};

interface DynamoDBMetricItem {
  pk: string;
  sk: string;
  timestamp: string;
  invocations: Record<string, number>;
  input_tokens: Record<string, number>;
  output_tokens: Record<string, number>;
  cache_read_tokens: Record<string, number>;
  cache_write_tokens: Record<string, number>;
  cost: Record<string, number>;
  cache_savings: Record<string, number>;
  latency_avg: Record<string, number>;
  ttl?: number;
}

function mapDynamoItemToMetric(item: DynamoDBMetricItem): MetricDataPoint {
  return {
    timestamp: item.timestamp ?? item.sk,
    invocations: item.invocations || {},
    inputTokens: item.input_tokens || {},
    outputTokens: item.output_tokens || {},
    cacheReadTokens: item.cache_read_tokens || {},
    cacheWriteTokens: item.cache_write_tokens || {},
    cost: item.cost || {},
    cacheSavings: item.cache_savings || {},
    latencyAvg: item.latency_avg || {},
  };
}

export async function queryMetricsByTimeRange(
  granularity: MetricGranularity,
  startTime: string,
  endTime: string
): Promise<MetricDataPoint[]> {
  const pk = GRANULARITY_TO_PK[granularity];

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND sk BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':start': startTime,
        ':end': endTime,
      },
      ScanIndexForward: true,
    })
  );

  const items = (result.Items ?? []) as DynamoDBMetricItem[];
  return items.map(mapDynamoItemToMetric);
}

export async function getCumulativeSummary(month?: string): Promise<CostSummary> {
  const targetMonth = month ?? new Date().toISOString().slice(0, 7);

  const cumulativeResult = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: PK.CUMULATIVE, sk: targetMonth },
    })
  );

  const item = cumulativeResult.Item;
  const totalCost = item?.total_cost ?? 0;
  const totalTokens = item?.total_tokens ?? 0;
  const lastUpdated = item?.last_updated ?? new Date().toISOString();

  // Map by_model from Lambda format {cost, tokens, invocations} to frontend ModelCostDetail
  const byModel: Record<string, ModelCostDetail> = {};
  const rawByModel = item?.by_model as Record<string, { cost?: number; tokens?: number; invocations?: number }> | undefined;
  if (rawByModel) {
    for (const [modelId, data] of Object.entries(rawByModel)) {
      byModel[modelId] = {
        cost: data.cost ?? 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        invocations: data.invocations ?? 0,
      };
    }
  }

  return {
    month: targetMonth,
    totalCost,
    totalTokens,
    byModel,
    lastUpdated,
  };
}

export async function getSettings(): Promise<Settings> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: PK.SETTINGS, sk: SK.CONFIG },
    })
  );

  if (!result.Item) {
    return {
      pricing: DEFAULT_PRICING,
    };
  }

  return {
    pricing: result.Item.pricing ?? DEFAULT_PRICING,
  };
}

export async function updateSettings(settings: Partial<Settings>): Promise<void> {
  const expressionParts: string[] = [];
  const expressionNames: Record<string, string> = {};
  const expressionValues: Record<string, unknown> = {};

  if (settings.pricing !== undefined) {
    expressionParts.push('#pr = :pr');
    expressionNames['#pr'] = 'pricing';
    expressionValues[':pr'] = settings.pricing;
  }

  if (expressionParts.length === 0) {
    return;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: PK.SETTINGS, sk: SK.CONFIG },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
    })
  );
}

export async function getLatestMetrics(count: number = 60): Promise<MetricDataPoint[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': PK.MINUTE,
      },
      ScanIndexForward: false,
      Limit: count,
    })
  );

  const items = (result.Items ?? []) as DynamoDBMetricItem[];
  return items.map(mapDynamoItemToMetric).reverse();
}
