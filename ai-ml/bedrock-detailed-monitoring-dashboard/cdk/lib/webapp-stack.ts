import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

interface WebAppStackProps extends cdk.StackProps {
  tableName: string;
  tableArn: string;
}

export class WebAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WebAppStackProps) {
    super(scope, id, props);

    // VPC with 2 AZs and 1 NAT Gateway
    const vpc = new ec2.Vpc(this, 'BedrockDashboardVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'BedrockDashboardCluster', {
      clusterName: 'bedrock-dashboard-cluster',
      vpc,
    });

    // Task Definition (ARM64 to match local Apple Silicon build)
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'BedrockDashboardTaskDef', {
      cpu: 512,
      memoryLimitMiB: 1024,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    // Task Role permissions
    taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudwatch:GetMetricData', 'cloudwatch:GetMetricStatistics'],
        resources: ['*'],
      })
    );

    taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:Query', 'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
        resources: [props.tableArn],
      })
    );

    // Container
    const container = taskDefinition.addContainer('BedrockDashboardContainer', {
      image: ecs.ContainerImage.fromAsset(path.join(__dirname, '../../webapp')),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'bedrock-dashboard',
      }),
      environment: {
        TABLE_NAME: props.tableName,
        AWS_REGION: 'us-east-1',
      },
      portMappings: [
        {
          containerPort: 3000,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });

    // Fargate Service
    const service = new ecs.FargateService(this, 'BedrockDashboardService', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // Internal Application Load Balancer (CloudFront VPC Origin)
    const alb = new elbv2.ApplicationLoadBalancer(this, 'BedrockDashboardAlb', {
      vpc,
      internetFacing: false,
    });

    // HTTP Listener (CloudFront terminates TLS, internal VPC traffic is HTTP)
    const httpListener = alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    httpListener.addTargets('EcsTarget', {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: {
        path: '/api/health',
        interval: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    // CloudFront VPC Origin → Internal ALB
    const vpcOrigin = origins.VpcOrigin.withApplicationLoadBalancer(alb, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      httpPort: 80,
    });

    const distribution = new cloudfront.Distribution(this, 'BedrockDashboardDistribution', {
      defaultBehavior: {
        origin: vpcOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront Dashboard URL',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });

  }
}
