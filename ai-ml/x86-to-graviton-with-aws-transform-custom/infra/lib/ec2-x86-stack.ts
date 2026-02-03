import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface Ec2X86StackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

/**
 * EC2 x86 스택
 * 비교 기준이 되는 x86 (Intel/AMD) 인스턴스
 */
export class Ec2X86Stack extends cdk.Stack {
  public readonly instance: ec2.Instance;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: Ec2X86StackProps) {
    super(scope, id, props);

    const { vpc } = props;

    // Security Group
    this.securityGroup = new ec2.SecurityGroup(this, 'X86SecurityGroup', {
      vpc,
      securityGroupName: 'graviton-demo-x86-sg',
      description: 'Security group for x86 demo instance',
      allowAllOutbound: true,
    });

    // SSH 접근 (필요시 IP 제한 권장)
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'Allow SSH access'
    );

    // HTTP 접근 (애플리케이션 포트)
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8080),
      'Allow HTTP access to application'
    );

    // IAM Role
    const role = new iam.Role(this, 'X86InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
      ],
      description: 'IAM role for x86 EC2 instance',
    });

    // User Data - Java 및 Docker 설치
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'set -ex',
      '',
      '# System update',
      'yum update -y',
      '',
      '# Install Java 17 (Amazon Corretto)',
      'yum install -y java-17-amazon-corretto-headless',
      '',
      '# Install Docker',
      'yum install -y docker',
      'systemctl start docker',
      'systemctl enable docker',
      'usermod -aG docker ec2-user',
      '',
      '# Install useful tools',
      'yum install -y htop curl wget',
      '',
      '# Log architecture info',
      'echo "Architecture: $(uname -m)" > /home/ec2-user/arch-info.txt',
      'java -version >> /home/ec2-user/arch-info.txt 2>&1',
      '',
      '# Signal completion',
      'echo "x86 instance setup complete"'
    );

    // EC2 Instance (x86 - t3.medium)
    this.instance = new ec2.Instance(this, 'X86Instance', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.X86_64,
      }),
      securityGroup: this.securityGroup,
      role,
      userData,
      instanceName: 'graviton-demo-x86',
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(20, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'InstanceId', {
      value: this.instance.instanceId,
      description: 'x86 Instance ID',
    });

    new cdk.CfnOutput(this, 'PublicIp', {
      value: this.instance.instancePublicIp,
      description: 'x86 Instance Public IP',
      exportName: 'GravitonDemo-X86-PublicIp',
    });

    new cdk.CfnOutput(this, 'InstanceType', {
      value: 't3.medium (x86_64)',
      description: 'Instance Type',
    });

    new cdk.CfnOutput(this, 'SSMConnectCommand', {
      value: `aws ssm start-session --target ${this.instance.instanceId}`,
      description: 'SSM Session Manager connect command',
    });
  }
}
