export interface AppConfig {
  /** Project name used for resource naming and tagging */
  projectName: string;
  /** Deployment environment */
  environment: 'prod' | 'dev';
  /** AWS region for deployment */
  region: string;
  /** Common tags applied to all resources */
  tags: Record<string, string>;
  /** OTLP gRPC port for the collector */
  collectorPort: number;
  /** OTLP HTTP port for the collector */
  collectorHttpPort: number;
  /** ACM certificate ARN for NLB TLS termination. If omitted, plain TCP listeners are used. */
  certificateArn?: string;
  /** ADOT Collector container image version tag */
  adotCollectorVersion: string;
}

export const appConfig: AppConfig = {
  projectName: 'claude-code-telemetry',
  environment: 'prod',
  region: 'us-east-1',
  tags: {
    Project: 'claude-code-telemetry',
    ManagedBy: 'cdk',
  },
  collectorPort: 4317,
  collectorHttpPort: 4318,
  // certificateArn: 'arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT-ID',
  adotCollectorVersion: 'v0.40.0',
};

/**
 * Generate a consistent resource name with project prefix and environment suffix.
 */
export function resourceName(config: AppConfig, name: string): string {
  return `${config.projectName}-${name}-${config.environment}`;
}

/**
 * Generate a short resource name for AWS resources with character limits
 * (e.g., NLB names have a 32-character limit).
 */
export function shortResourceName(config: AppConfig, name: string): string {
  return `ccotel-${name}-${config.environment}`;
}
