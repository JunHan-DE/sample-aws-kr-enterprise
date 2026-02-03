import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

/**
 * VPC 스택
 * Graviton 마이그레이션 데모를 위한 네트워크 인프라
 */
export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC 생성
    this.vpc = new ec2.Vpc(this, 'GravitonDemoVpc', {
      vpcName: 'graviton-demo-vpc',
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
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

    // VPC Flow Logs (선택사항 - 비용 발생)
    // this.vpc.addFlowLog('FlowLog', {
    //   destination: ec2.FlowLogDestination.toCloudWatchLogs(),
    // });

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: 'GravitonDemo-VpcId',
    });

    new cdk.CfnOutput(this, 'PublicSubnets', {
      value: this.vpc.publicSubnets.map(s => s.subnetId).join(','),
      description: 'Public Subnet IDs',
    });

    new cdk.CfnOutput(this, 'PrivateSubnets', {
      value: this.vpc.privateSubnets.map(s => s.subnetId).join(','),
      description: 'Private Subnet IDs',
    });
  }
}
