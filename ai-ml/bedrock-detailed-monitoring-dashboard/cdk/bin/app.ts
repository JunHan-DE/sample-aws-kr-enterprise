#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DataPipelineStack } from '../lib/data-pipeline-stack';
import { WebAppStack } from '../lib/webapp-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

const dataPipelineStack = new DataPipelineStack(app, 'DataPipelineStack', { env });

new WebAppStack(app, 'WebAppStack', {
  env,
  tableName: dataPipelineStack.tableName,
  tableArn: dataPipelineStack.tableArn,
});
