#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { EcrStack } from '../lib/ecr-stack';
import { Ec2X86Stack } from '../lib/ec2-x86-stack';
import { Ec2GravitonStack } from '../lib/ec2-graviton-stack';

const app = new cdk.App();

// 환경 설정
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-2',
};

// 공통 태그
const commonTags = {
  Project: 'GravitonMigration',
  Environment: 'demo',
  ManagedBy: 'CDK',
};

// VPC 스택
const vpcStack = new VpcStack(app, 'VpcStack', {
  env,
  description: 'VPC infrastructure for Graviton migration demo',
});

// ECR 스택
const ecrStack = new EcrStack(app, 'EcrStack', {
  env,
  description: 'ECR repository for multi-arch images',
});

// EC2 x86 스택
const ec2X86Stack = new Ec2X86Stack(app, 'Ec2X86Stack', {
  env,
  vpc: vpcStack.vpc,
  description: 'EC2 x86 instance for comparison',
});
ec2X86Stack.addDependency(vpcStack);

// EC2 Graviton 스택
const ec2GravitonStack = new Ec2GravitonStack(app, 'Ec2GravitonStack', {
  env,
  vpc: vpcStack.vpc,
  description: 'EC2 Graviton instance for migration target',
});
ec2GravitonStack.addDependency(vpcStack);

// 공통 태그 적용
Object.entries(commonTags).forEach(([key, value]) => {
  cdk.Tags.of(app).add(key, value);
});

app.synth();
