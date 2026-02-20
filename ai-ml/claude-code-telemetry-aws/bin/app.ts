#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { appConfig } from '../lib/config/app-config.js';
import { TelemetryStack } from '../lib/telemetry-stack.js';

const app = new cdk.App();

new TelemetryStack(app, 'TelemetryStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: appConfig.region,
  },
  config: appConfig,
  tags: appConfig.tags,
});

app.synth();
