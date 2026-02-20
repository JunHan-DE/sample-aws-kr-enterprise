import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { AppConfig, resourceName } from '../config/app-config.js';

export interface NetworkNestedStackProps extends cdk.NestedStackProps {
  readonly config: AppConfig;
}

/**
 * NetworkNestedStack provisions the VPC, subnets, and security groups
 * for the ADOT Collector ECS service and NLB.
 */
export class NetworkNestedStack extends cdk.NestedStack {
  /** VPC hosting the collector infrastructure */
  public readonly vpc: ec2.IVpc;
  /** Security group for the ADOT Collector ECS tasks */
  public readonly collectorSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkNestedStackProps) {
    super(scope, id, props);

    const { config } = props;

    // VPC with public + private subnets across 2 AZs
    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: resourceName(config, 'vpc'),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    this.vpc = vpc;

    // VPC Flow Logs to CloudWatch Logs for network-level auditing
    const flowLogGroup = new logs.LogGroup(this, 'VpcFlowLogGroup', {
      logGroupName: `/vpc/${resourceName(config, 'flow-logs')}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    vpc.addFlowLog('FlowLogToCloudWatch', {
      destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    // Security group for collector tasks: allow OTLP gRPC and HTTP ingress
    this.collectorSecurityGroup = new ec2.SecurityGroup(this, 'CollectorSg', {
      vpc: this.vpc,
      securityGroupName: resourceName(config, 'collector-sg'),
      description: 'Security group for ADOT Collector ECS tasks',
      allowAllOutbound: true,
    });

    // NLB forwards traffic from within the VPC, so restrict ingress to VPC CIDR.
    // This prevents direct access to collector ports from the public internet.
    this.collectorSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(config.collectorPort),
      'Allow OTLP gRPC from VPC (via NLB)',
    );

    this.collectorSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(config.collectorHttpPort),
      'Allow OTLP HTTP from VPC (via NLB)',
    );

    this.collectorSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(13133),
      'Allow health check from NLB',
    );
  }
}
