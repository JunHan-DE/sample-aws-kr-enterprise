export interface ModelPricing {
  name: string;
  shortName: string;
  family: 'opus' | 'sonnet' | 'haiku';
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Global Cross-region Inference — AWS Bedrock (US East - N. Virginia) On-Demand pricing
  'global.anthropic.claude-opus-4-6-v1': { name: 'Claude Opus 4.6', shortName: 'Opus 4.6', family: 'opus', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.50 },
  'global.anthropic.claude-opus-4-5-20251101-v1:0': { name: 'Claude Opus 4.5', shortName: 'Opus 4.5', family: 'opus', input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.50 },
  'global.anthropic.claude-sonnet-4-6': { name: 'Claude Sonnet 4.6', shortName: 'Sonnet 4.6', family: 'sonnet', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 },
  'global.anthropic.claude-sonnet-4-5-20250929-v1:0': { name: 'Claude Sonnet 4.5', shortName: 'Sonnet 4.5', family: 'sonnet', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 },
  'global.anthropic.claude-haiku-4-5-20251001-v1:0': { name: 'Claude Haiku 4.5', shortName: 'Haiku 4.5', family: 'haiku', input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.10 },
  // Geo / In-region Cross-region Inference — 10% premium over Global
  'us.anthropic.claude-opus-4-5-20251101-v1:0': { name: 'Claude Opus 4.5 (US)', shortName: 'Opus 4.5 US', family: 'opus', input: 5.50, output: 27.50, cacheWrite: 6.875, cacheRead: 0.55 },
  'us.anthropic.claude-haiku-4-5-20251001-v1:0': { name: 'Claude Haiku 4.5 (US)', shortName: 'Haiku 4.5 US', family: 'haiku', input: 1.10, output: 5.50, cacheWrite: 1.375, cacheRead: 0.11 },
  'us.anthropic.claude-3-5-haiku-20241022-v1:0': { name: 'Claude Haiku 3.5 (US)', shortName: 'Haiku 3.5 US', family: 'haiku', input: 0.80, output: 4, cacheWrite: 1.00, cacheRead: 0.08 },
};

export const MODEL_IDS = Object.keys(MODEL_PRICING);
export const MODEL_FAMILIES = ['opus', 'sonnet', 'haiku'] as const;
export type ModelFamily = typeof MODEL_FAMILIES[number];

export const FAMILY_COLORS: Record<ModelFamily, string> = {
  opus: '#8b5cf6',
  sonnet: '#3b82f6',
  haiku: '#10b981',
};
