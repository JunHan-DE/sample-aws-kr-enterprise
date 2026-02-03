import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface Ec2GravitonStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

/**
 * EC2 Graviton 스택
 * 마이그레이션 대상인 Graviton (ARM64) 인스턴스
 */
export class Ec2GravitonStack extends cdk.Stack {
  public readonly instance: ec2.Instance;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: Ec2GravitonStackProps) {
    super(scope, id, props);

    const { vpc } = props;

    // Security Group
    this.securityGroup = new ec2.SecurityGroup(this, 'GravitonSecurityGroup', {
      vpc,
      securityGroupName: 'graviton-demo-arm64-sg',
      description: 'Security group for Graviton demo instance',
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
    const role = new iam.Role(this, 'GravitonInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
      ],
      description: 'IAM role for Graviton EC2 instance',
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
      '# Install Java 17 (Amazon Corretto for ARM64)',
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
      '# Graviton-specific optimizations info',
      'echo "" >> /home/ec2-user/arch-info.txt',
      'echo "=== Graviton Instance ===" >> /home/ec2-user/arch-info.txt',
      'echo "Recommended JVM flags for Graviton:" >> /home/ec2-user/arch-info.txt',
      'echo "  -XX:+UseG1GC" >> /home/ec2-user/arch-info.txt',
      'echo "  -XX:+UseNUMA" >> /home/ec2-user/arch-info.txt',
      'echo "  -XX:+AlwaysPreTouch" >> /home/ec2-user/arch-info.txt',
      '',
      '# Signal completion',
      'echo "Graviton instance setup complete"'
    );

    // EC2 Instance (Graviton - t4g.medium)
    this.instance = new ec2.Instance(this, 'GravitonInstance', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MEDIUM),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
      securityGroup: this.securityGroup,
      role,
      userData,
      instanceName: 'graviton-demo-arm64',
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
      description: 'Graviton Instance ID',
    });

    new cdk.CfnOutput(this, 'PublicIp', {
      value: this.instance.instancePublicIp,
      description: 'Graviton Instance Public IP',
      exportName: 'GravitonDemo-Graviton-PublicIp',
    });

    new cdk.CfnOutput(this, 'InstanceType', {
      value: 't4g.medium (ARM64/Graviton)',
      description: 'Instance Type',
    });

    new cdk.CfnOutput(this, 'SSMConnectCommand', {
      value: `aws ssm start-session --target ${this.instance.instanceId}`,
      description: 'SSM Session Manager connect command',
    });

    // 비용 비교 정보
    new cdk.CfnOutput(this, 'CostComparison', {
      value: 't4g.medium: $0.0336/hr vs t3.medium: $0.0416/hr (약 19% 절감)',
      description: 'Cost comparison with x86 equivalent',
    });
  }
}
