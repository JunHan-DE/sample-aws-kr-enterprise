#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { SampleAppStack } from "../lib/sample-app-stack";
import { AiopsPlatformStack } from "../lib/aiops-platform-stack";

const app = new cdk.App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION || "ap-northeast-2" };

// Fully independent stacks — no cross-stack dependency.
// AIOps platform discovers workloads via DDB registration, not SSM/exports.
new SampleAppStack(app, "AiopsSampleAppStack", { env });
new AiopsPlatformStack(app, "AiopsPlatformStack", { env });
