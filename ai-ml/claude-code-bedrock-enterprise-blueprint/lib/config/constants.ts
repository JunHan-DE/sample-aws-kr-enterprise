export const PROJECT_NAME = 'claude-code-gateway';

export const MODELS = {
  DEFAULT_FAST: 'default-fast',
  DEFAULT_SMART: 'default-smart',
  OSS_LOCAL: 'oss-local',
  BEDROCK_SONNET: 'bedrock-sonnet',
} as const;

export const DEFAULT_REGION = 'ap-northeast-2';

export const BUDGET = {
  MONTHLY_LIMIT_USD: 1000,
  ALERT_THRESHOLDS_PCT: [70, 90, 100],
} as const;
