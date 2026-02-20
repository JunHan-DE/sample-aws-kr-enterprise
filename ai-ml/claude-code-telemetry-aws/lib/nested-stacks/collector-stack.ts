import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as fs from 'fs';
import * as path from 'path';
import { Construct } from 'constructs';
import { AppConfig, resourceName, shortResourceName } from '../config/app-config.js';

/** Health check port used by the ADOT Collector health_check extension */
const HEALTH_CHECK_PORT = 13133;

export interface CollectorNestedStackProps extends cdk.NestedStackProps {
  readonly config: AppConfig;
  /** VPC from NetworkNestedStack */
  readonly vpc: ec2.IVpc;
  /** Security group for collector tasks from NetworkNestedStack */
  readonly collectorSecurityGroup: ec2.ISecurityGroup;
  /** AMP workspace ARN from MetricsNestedStack */
  readonly ampWorkspaceArn: string;
  /** AMP remote write URL from MetricsNestedStack */
  readonly ampRemoteWriteUrl: string;
  /** CloudWatch Logs group name from EventsNestedStack */
  readonly logGroupName: string;
  /** CloudWatch Logs group ARN from EventsNestedStack */
  readonly logGroupArn: string;
}

/**
 * CollectorNestedStack provisions the ECS Fargate cluster running the ADOT Collector
 * behind a Network Load Balancer. The collector receives OTLP data from
 * developer PCs and forwards metrics to AMP and events to CloudWatch Logs.
 *
 * ADOT collector config from /config/adot-collector-config.yaml is injected
 * via the AOT_CONFIG_CONTENT environment variable with dynamic values
 * substituted at deployment time.
 */
export class CollectorNestedStack extends cdk.NestedStack {
  /** NLB DNS name for OTLP endpoint */
  public readonly nlbDnsName: string;

  constructor(scope: Construct, id: string, props: CollectorNestedStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Load ADOT collector config YAML to inject via AOT_CONFIG_CONTENT
    const adotConfigPath = path.join(__dirname, '..', '..', 'config', 'adot-collector-config.yaml');
    const adotConfigContent = fs.readFileSync(adotConfigPath, 'utf-8');

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'CollectorCluster', {
      clusterName: resourceName(config, 'collector'),
      vpc: props.vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    // Task execution role (for pulling images, pushing logs)
    const executionRole = new iam.Role(this, 'TaskExecutionRole', {
      roleName: resourceName(config, 'collector-exec-role'),
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Task role (for ADOT to write to AMP and CloudWatch Logs)
    const taskRole = new iam.Role(this, 'TaskRole', {
      roleName: resourceName(config, 'collector-task-role'),
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // AMP remote write permissions
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'aps:RemoteWrite',
        ],
        resources: [props.ampWorkspaceArn],
      }),
    );

    // CloudWatch Logs permissions for awscloudwatchlogs exporter
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'logs:DescribeLogGroups',
          'logs:DescribeLogStreams',
        ],
        resources: [
          props.logGroupArn,
          `${props.logGroupArn}:*`,
        ],
      }),
    );

    // Fargate task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'CollectorTaskDef', {
      family: resourceName(config, 'collector'),
      cpu: 512,
      memoryLimitMiB: 1024,
      executionRole,
      taskRole,
    });

    const logGroup = new logs.LogGroup(this, 'CollectorLogGroup', {
      logGroupName: `/ecs/${resourceName(config, 'collector')}`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ADOT Collector config injected via AOT_CONFIG_CONTENT environment variable.
    // ADOT reads AOT_CONFIG_CONTENT by default (no --config flag needed).
    // Environment variables are resolved by the ADOT Collector at startup:
    //   ${AWS_REGION}                  -> config.region
    //   ${AMP_REMOTE_WRITE_ENDPOINT}   -> props.ampRemoteWriteUrl
    //   ${CW_LOG_GROUP_NAME}           -> props.logGroupName
    taskDefinition.addContainer('adot-collector', {
      containerName: 'adot-collector',
      image: ecs.ContainerImage.fromRegistry(`public.ecr.aws/aws-observability/aws-otel-collector:${config.adotCollectorVersion}`),
      portMappings: [
        { containerPort: config.collectorPort, protocol: ecs.Protocol.TCP },   // gRPC OTLP
        { containerPort: config.collectorHttpPort, protocol: ecs.Protocol.TCP }, // HTTP OTLP
        { containerPort: HEALTH_CHECK_PORT, protocol: ecs.Protocol.TCP },       // Health check
      ],
      logging: ecs.LogDrivers.awsLogs({
        logGroup,
        streamPrefix: 'adot',
      }),
      environment: {
        AOT_CONFIG_CONTENT: adotConfigContent,
        AWS_REGION: config.region,
        AMP_REMOTE_WRITE_ENDPOINT: props.ampRemoteWriteUrl,
        CW_LOG_GROUP_NAME: props.logGroupName,
      },
      // No ECS container health check — ADOT v0.40.0 uses a scratch-based image
      // with no shell (sh/bash), wget, or curl. Health is monitored via
      // NLB target group HTTP health checks on the health_check extension (port 13133).
    });

    // ECS Fargate Service with circuit breaker for fast rollback on failed deployments
    const service = new ecs.FargateService(this, 'CollectorService', {
      serviceName: resourceName(config, 'collector-svc'),
      cluster,
      taskDefinition,
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      securityGroups: [props.collectorSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      circuitBreaker: { rollback: true },
    });

    // Auto-scaling: min 1, max 5, CPU target 70%
    const scaling = service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 5,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Network Load Balancer (internet-facing for developer PCs)
    const nlb = new elbv2.NetworkLoadBalancer(this, 'CollectorNlb', {
      loadBalancerName: shortResourceName(config, 'collector-nlb'),
      vpc: props.vpc,
      internetFacing: true,
      crossZoneEnabled: true,
    });

    // gRPC target group (port 4317) with optimized health check
    const grpcTargetGroup = new elbv2.NetworkTargetGroup(this, 'GrpcTargetGroup', {
      targetGroupName: shortResourceName(config, 'grpc-tg'),
      port: config.collectorPort,
      protocol: elbv2.Protocol.TCP,
      targetType: elbv2.TargetType.IP,
      vpc: props.vpc,
      deregistrationDelay: cdk.Duration.seconds(30),
      healthCheck: {
        protocol: elbv2.Protocol.HTTP,
        port: String(HEALTH_CHECK_PORT),
        path: '/',
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
        interval: cdk.Duration.seconds(10),
      },
    });

    // HTTP target group (port 4318) with optimized health check
    const httpTargetGroup = new elbv2.NetworkTargetGroup(this, 'HttpTargetGroup', {
      targetGroupName: shortResourceName(config, 'http-tg'),
      port: config.collectorHttpPort,
      protocol: elbv2.Protocol.TCP,
      targetType: elbv2.TargetType.IP,
      vpc: props.vpc,
      deregistrationDelay: cdk.Duration.seconds(30),
      healthCheck: {
        protocol: elbv2.Protocol.HTTP,
        port: String(HEALTH_CHECK_PORT),
        path: '/',
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
        interval: cdk.Duration.seconds(10),
      },
    });

    // NLB Listeners: Use TLS termination when an ACM certificate is provided,
    // otherwise fall back to plain TCP for dev/test environments.
    if (config.certificateArn) {
      const cert = elbv2.ListenerCertificate.fromArn(config.certificateArn);

      nlb.addListener('GrpcListener', {
        port: config.collectorPort,
        protocol: elbv2.Protocol.TLS,
        certificates: [cert],
        sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS,
        defaultTargetGroups: [grpcTargetGroup],
      });

      nlb.addListener('HttpListener', {
        port: config.collectorHttpPort,
        protocol: elbv2.Protocol.TLS,
        certificates: [cert],
        sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS,
        defaultTargetGroups: [httpTargetGroup],
      });
    } else {
      nlb.addListener('GrpcListener', {
        port: config.collectorPort,
        protocol: elbv2.Protocol.TCP,
        defaultTargetGroups: [grpcTargetGroup],
      });

      nlb.addListener('HttpListener', {
        port: config.collectorHttpPort,
        protocol: elbv2.Protocol.TCP,
        defaultTargetGroups: [httpTargetGroup],
      });
    }

    // Attach service to target groups
    service.attachToNetworkTargetGroup(grpcTargetGroup);
    service.attachToNetworkTargetGroup(httpTargetGroup);

    this.nlbDnsName = nlb.loadBalancerDnsName;
  }
}
