import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Construct } from 'constructs';

export class DataPipelineStack extends cdk.Stack {
  public readonly tableName: string;
  public readonly tableArn: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const table = new dynamodb.Table(this, 'BedrockUsageMetrics', {
      tableName: 'BedrockUsageMetrics',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.tableName = table.tableName;
    this.tableArn = table.tableArn;

    // Lambda Function
    const aggregatorFn = new lambda.Function(this, 'BedrockMetricsAggregator', {
      functionName: 'BedrockMetricsAggregator',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/aggregator')),
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      environment: {
        TABLE_NAME: table.tableName,
        REGION: 'us-east-1',
      },
    });

    // Lambda IAM permissions
    aggregatorFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudwatch:GetMetricData'],
        resources: ['*'],
      })
    );

    table.grant(aggregatorFn, 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query', 'dynamodb:GetItem');

    // EventBridge rule: invoke Lambda every 1 minute
    const rule = new events.Rule(this, 'AggregatorScheduleRule', {
      ruleName: 'BedrockMetricsAggregatorSchedule',
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
    });

    rule.addTarget(new targets.LambdaFunction(aggregatorFn));

    // Outputs
    new cdk.CfnOutput(this, 'TableName', {
      value: table.tableName,
      exportName: 'BedrockUsageMetricsTableName',
    });

    new cdk.CfnOutput(this, 'TableArn', {
      value: table.tableArn,
      exportName: 'BedrockUsageMetricsTableArn',
    });
  }
}
