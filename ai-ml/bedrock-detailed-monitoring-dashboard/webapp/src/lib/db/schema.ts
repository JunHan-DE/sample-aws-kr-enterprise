export const TABLE_NAME = process.env.TABLE_NAME || 'BedrockUsageMetrics';
export const REGION = process.env.AWS_REGION || 'us-east-1';

export const PK = {
  MINUTE: 'METRIC#minute',
  HOURLY: 'METRIC#hourly',
  DAILY: 'METRIC#daily',
  CUMULATIVE: 'CUMULATIVE',
  SETTINGS: 'SETTINGS',
} as const;

export const SK = {
  CONFIG: 'CONFIG',
} as const;

export const TTL_SECONDS = {
  MINUTE: 7 * 24 * 60 * 60,    // 7 days
  HOURLY: 90 * 24 * 60 * 60,   // 90 days
} as const;
