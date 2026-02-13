export interface MetricDataPoint {
  timestamp: string;
  invocations: Record<string, number>;
  inputTokens: Record<string, number>;
  outputTokens: Record<string, number>;
  cacheReadTokens: Record<string, number>;
  cacheWriteTokens: Record<string, number>;
  cost: Record<string, number>;
  cacheSavings: Record<string, number>;
  latencyAvg: Record<string, number>;
}

export interface CostSummary {
  month: string;
  totalCost: number;
  totalTokens: number;
  byModel: Record<string, ModelCostDetail>;
  lastUpdated: string;
}

export interface ModelCostDetail {
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  invocations: number;
}

export interface Settings {
  pricing: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }>;
}

export interface CostForecast {
  currentCost: number;
  projectedMonthEnd: number;
  daysElapsed: number;
  daysInMonth: number;
  dailyAverage: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | 'custom';
export type MetricGranularity = 'minute' | 'hourly' | 'daily';
