import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AppConfig } from './config/app-config.js';
import { NetworkNestedStack } from './nested-stacks/network-stack.js';
import { MetricsNestedStack } from './nested-stacks/metrics-stack.js';
import { EventsNestedStack } from './nested-stacks/events-stack.js';
import { CollectorNestedStack } from './nested-stacks/collector-stack.js';
import { DashboardNestedStack } from './nested-stacks/dashboard-stack.js';

export interface TelemetryStackProps extends cdk.StackProps {
  readonly config: AppConfig;
}

export class TelemetryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TelemetryStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Independent nested stacks (created in parallel by CloudFormation)
    const network = new NetworkNestedStack(this, 'Network', { config });
    const metrics = new MetricsNestedStack(this, 'Metrics', { config });
    const events = new EventsNestedStack(this, 'Events', { config });

    // CollectorNestedStack: depends on Network + Metrics + Events
    const collector = new CollectorNestedStack(this, 'Collector', {
      config,
      vpc: network.vpc,
      collectorSecurityGroup: network.collectorSecurityGroup,
      ampWorkspaceArn: metrics.workspaceArn,
      ampRemoteWriteUrl: metrics.remoteWriteUrl,
      logGroupName: events.logGroupName,
      logGroupArn: events.logGroupArn,
    });

    // DashboardNestedStack: depends on Metrics + Events
    const dashboard = new DashboardNestedStack(this, 'Dashboard', {
      config,
      ampWorkspaceArn: metrics.workspaceArn,
      ampWorkspaceId: metrics.workspaceId,
      glueDatabaseName: events.glueDatabaseName,
      eventsBucketArn: events.eventsBucketArn,
    });

    // Root stack outputs (key operational endpoints)
    new cdk.CfnOutput(this, 'CollectorEndpoint', {
      value: `${collector.nlbDnsName}:${config.collectorPort}`,
      description: 'OTLP gRPC Collector Endpoint',
    });

    new cdk.CfnOutput(this, 'CollectorHttpEndpoint', {
      value: `${collector.nlbDnsName}:${config.collectorHttpPort}`,
      description: 'OTLP HTTP Collector Endpoint',
    });

    new cdk.CfnOutput(this, 'GrafanaEndpoint', {
      value: `https://${dashboard.grafanaEndpoint}`,
      description: 'Grafana Workspace URL',
    });
  }
}
