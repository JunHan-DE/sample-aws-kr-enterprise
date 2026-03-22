export const PROJECT_NAME = 'claude-code-enterprise';

export const MODELS = {
  OPUS_4_6: 'us.anthropic.claude-opus-4-6-v1',
  SONNET_4_6: 'us.anthropic.claude-sonnet-4-6',
  HAIKU_4_5: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
} as const;

export const DEFAULT_REGION = 'us-east-1';

export const BUDGET = {
  MONTHLY_LIMIT_USD: 1000,
  ALERT_THRESHOLDS_PCT: [70, 90, 100],
} as const;
