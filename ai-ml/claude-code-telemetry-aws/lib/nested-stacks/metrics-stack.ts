import * as cdk from 'aws-cdk-lib';
import * as aps from 'aws-cdk-lib/aws-aps';
import { Construct } from 'constructs';
import { AppConfig, resourceName } from '../config/app-config.js';

export interface MetricsNestedStackProps extends cdk.NestedStackProps {
  readonly config: AppConfig;
}

/**
 * MetricsNestedStack provisions the Amazon Managed Service for Prometheus (AMP)
 * workspace where the ADOT Collector writes metrics via remote write.
 */
export class MetricsNestedStack extends cdk.NestedStack {
  /** AMP workspace ARN for IAM policies */
  public readonly workspaceArn: string;
  /** AMP workspace ID for collector configuration */
  public readonly workspaceId: string;
  /** AMP remote write endpoint URL */
  public readonly remoteWriteUrl: string;

  constructor(scope: Construct, id: string, props: MetricsNestedStackProps) {
    super(scope, id, props);

    const { config } = props;

    const workspace = new aps.CfnWorkspace(this, 'AmpWorkspace', {
      alias: resourceName(config, 'amp'),
      tags: Object.entries(config.tags).map(([key, value]) => ({ key, value })),
    });

    this.workspaceArn = workspace.attrArn;
    this.workspaceId = workspace.attrWorkspaceId;
    this.remoteWriteUrl = `https://aps-workspaces.${config.region}.amazonaws.com/workspaces/${workspace.attrWorkspaceId}/api/v1/remote_write`;
  }
}
