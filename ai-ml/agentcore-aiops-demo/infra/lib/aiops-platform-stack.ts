import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambdaEvents from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as opensearch from "aws-cdk-lib/aws-opensearchserverless";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as agentcore from "aws-cdk-lib/aws-bedrockagentcore";
import { Construct } from "constructs";

const SONNET_MODEL_ID = "global.anthropic.claude-sonnet-4-6";
const EMBED_MODEL_ARN = "arn:aws:bedrock:ap-northeast-2::foundation-model/amazon.titan-embed-text-v2:0";

export class AiopsPlatformStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========== DynamoDB ==========
    const workloadsTable = new dynamodb.Table(this, "WorkloadsTable", {
      tableName: "aiops-demo-workloads",
      partitionKey: { name: "workload_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const reportsTable = new dynamodb.Table(this, "ReportsTable", {
      tableName: "aiops-demo-reports",
      partitionKey: { name: "report_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    reportsTable.addGlobalSecondaryIndex({
      indexName: "workload-created-index",
      partitionKey: { name: "workload_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "created_at", type: dynamodb.AttributeType.STRING },
    });
    const snapshotsTable = new dynamodb.Table(this, "SnapshotsTable", {
      tableName: "aiops-demo-snapshots",
      partitionKey: { name: "scenario_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ========== S3 ==========
    const knowledgeBucket = new s3.Bucket(this, "KnowledgeBucket", {
      bucketName: `aiops-demo-knowledge-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, autoDeleteObjects: true,
      cors: [{ allowedMethods: [s3.HttpMethods.PUT], allowedOrigins: ["*"], allowedHeaders: ["*"] }],
    });
    new s3deploy.BucketDeployment(this, "SeedKnowledge", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../knowledge-base"))],
      destinationBucket: knowledgeBucket,
    });

    const buildBucket = new s3.Bucket(this, "BuildBucket", {
      bucketName: `aiops-demo-build-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, autoDeleteObjects: true,
    });

    const webBucket = new s3.Bucket(this, "WebBucket", {
      bucketName: `aiops-demo-web-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // ========== OpenSearch Serverless ==========
    const encPolicy = new opensearch.CfnSecurityPolicy(this, "OssEncPolicy", {
      name: "aiops-demo-enc", type: "encryption",
      policy: JSON.stringify({ Rules: [{ ResourceType: "collection", Resource: ["collection/aiops-demo-kb"] }], AWSOwnedKey: true }),
    });
    const netPolicy = new opensearch.CfnSecurityPolicy(this, "OssNetPolicy", {
      name: "aiops-demo-net", type: "network",
      policy: JSON.stringify([{ Rules: [{ ResourceType: "collection", Resource: ["collection/aiops-demo-kb"] }, { ResourceType: "dashboard", Resource: ["collection/aiops-demo-kb"] }], AllowFromPublic: true }]),
    });
    const ossCollection = new opensearch.CfnCollection(this, "OssCollection", { name: "aiops-demo-kb", type: "VECTORSEARCH" });
    ossCollection.addDependency(encPolicy);
    ossCollection.addDependency(netPolicy);

    // KB Role
    const kbRole = new iam.Role(this, "KbRole", {
      assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com"),
      inlinePolicies: { kb: new iam.PolicyDocument({ statements: [
        new iam.PolicyStatement({ actions: ["s3:GetObject", "s3:ListBucket"], resources: [knowledgeBucket.bucketArn, `${knowledgeBucket.bucketArn}/*`] }),
        new iam.PolicyStatement({ actions: ["bedrock:InvokeModel"], resources: ["*"] }),
        new iam.PolicyStatement({ actions: ["aoss:APIAccessAll"], resources: [ossCollection.attrArn] }),
      ]})},
    });

    // Index creator Lambda (waits 2min for access policy propagation)
    const indexCreator = new lambda.Function(this, "OssIndexCreator", {
      runtime: lambda.Runtime.PYTHON_3_12, handler: "handler.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../src/lambdas/oss_index_creator"), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: ["bash", "-c", "pip install opensearch-py requests-aws4auth -t /asset-output && cp handler.py /asset-output/"],
          local: {
            tryBundle(outputDir: string) {
              require("child_process").execSync(
                `cd ${path.join(__dirname, "../../src/lambdas/oss_index_creator")} && pip install opensearch-py requests-aws4auth -t ${outputDir} --quiet && cp handler.py ${outputDir}/`
              );
              return true;
            },
          },
        },
      }),
      timeout: cdk.Duration.seconds(900), memorySize: 256,
    });
    indexCreator.addToRolePolicy(new iam.PolicyStatement({ actions: ["aoss:APIAccessAll", "aoss:ListCollections", "aoss:BatchGetCollection"], resources: ["*"] }));

    const accessPolicy = new opensearch.CfnAccessPolicy(this, "OssAccessPolicy", {
      name: "aiops-demo-access", type: "data",
      policy: JSON.stringify([{
        Rules: [
          { ResourceType: "index", Resource: ["index/aiops-demo-kb/*"], Permission: ["aoss:CreateIndex", "aoss:UpdateIndex", "aoss:DescribeIndex", "aoss:ReadDocument", "aoss:WriteDocument"] },
          { ResourceType: "collection", Resource: ["collection/aiops-demo-kb"], Permission: ["aoss:CreateCollectionItems", "aoss:UpdateCollectionItems", "aoss:DescribeCollectionItems"] },
        ],
        Principal: [kbRole.roleArn, indexCreator.role!.roleArn],
      }]),
    });

    const indexCr = new cdk.CustomResource(this, "CreateOssIndex", {
      serviceToken: indexCreator.functionArn,
      properties: { CollectionEndpoint: ossCollection.attrCollectionEndpoint, CollectionName: "aiops-demo-kb", IndexName: "aiops-demo-index" },
    });
    indexCr.node.addDependency(ossCollection);
    indexCr.node.addDependency(accessPolicy);

    // ========== Bedrock Knowledge Base ==========
    const kb = new bedrock.CfnKnowledgeBase(this, "KnowledgeBase", {
      name: "aiops-demo-kb", roleArn: kbRole.roleArn,
      knowledgeBaseConfiguration: { type: "VECTOR", vectorKnowledgeBaseConfiguration: { embeddingModelArn: EMBED_MODEL_ARN } },
      storageConfiguration: {
        type: "OPENSEARCH_SERVERLESS",
        opensearchServerlessConfiguration: {
          collectionArn: ossCollection.attrArn,
          fieldMapping: { metadataField: "metadata", textField: "text", vectorField: "vector" },
          vectorIndexName: "aiops-demo-index",
        },
      },
    });
    kb.node.addDependency(indexCr);

    const dataSource = new bedrock.CfnDataSource(this, "KbDataSource", {
      knowledgeBaseId: kb.attrKnowledgeBaseId, name: "aiops-demo-s3",
      dataSourceConfiguration: { type: "S3", s3Configuration: { bucketArn: knowledgeBucket.bucketArn } },
    });

    // ========== AgentCore Runtime (container via CodeBuild) ==========
    const agentCoreRole = new iam.Role(this, "AgentCoreRole", {
      assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
      inlinePolicies: { perms: new iam.PolicyDocument({ statements: [
        // Read-only: investigation
        new iam.PolicyStatement({
          actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream", "bedrock:Retrieve",
            "logs:*", "cloudwatch:Describe*", "cloudwatch:Get*", "cloudwatch:List*",
            "cloudtrail:LookupEvents",
            "config:Get*", "config:List*", "config:Describe*",
            "ec2:Describe*", "ec2:GetConsoleOutput",
            "elasticloadbalancing:Describe*", "rds:Describe*", "autoscaling:Describe*",
            "ecs:Describe*", "ecs:List*",
            "lambda:Get*", "lambda:List*",
            "route53:Get*", "route53:List*",
            "s3:GetObject", "s3:ListBucket",
            "dynamodb:GetItem", "dynamodb:Scan", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem",
            "ecr:GetAuthorizationToken", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"],
          resources: ["*"],
        }),
        // Write: remediation (specific APIs only, no destructive actions)
        new iam.PolicyStatement({
          actions: [
            "ec2:RebootInstances", "ec2:StopInstances", "ec2:StartInstances",
            "ec2:AuthorizeSecurityGroupIngress", "ec2:RevokeSecurityGroupIngress",
            "ec2:AuthorizeSecurityGroupEgress", "ec2:RevokeSecurityGroupEgress",
            "autoscaling:SetDesiredCapacity", "autoscaling:SuspendProcesses", "autoscaling:ResumeProcesses",
            "rds:RebootDBInstance", "rds:FailoverDBCluster",
            "elasticloadbalancing:RegisterTargets", "elasticloadbalancing:DeregisterTargets",
            "ecs:UpdateService", "ecs:StopTask",
            "lambda:UpdateFunctionConfiguration",
            "route53:ChangeResourceRecordSets",
            "cloudwatch:SetAlarmState", "cloudwatch:PutMetricAlarm",
          ],
          resources: ["*"],
        }),
        // Memory operations
        new iam.PolicyStatement({
          actions: ["bedrock-agentcore:*Memory*", "bedrock-agentcore:*Event*", "bedrock-agentcore:*Session*"],
          resources: ["*"],
        }),
      ]})},
    });

    // ECR repository
    const ecr = new cdk.aws_ecr.Repository(this, "AgentEcr", {
      repositoryName: "aiops-demo-agent",
      removalPolicy: cdk.RemovalPolicy.DESTROY, emptyOnDelete: true,
    });

    // CodeBuild project to build + push Docker image
    const buildProject = new cdk.aws_codebuild.Project(this, "AgentBuild", {
      projectName: "aiops-demo-agent-build",
      source: cdk.aws_codebuild.Source.s3({ bucket: buildBucket, path: "agent-build/src/agents/app/" }),
      environment: {
        buildImage: cdk.aws_codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
        privileged: true,
      },
      environmentVariables: {
        ECR_REPO: { value: ecr.repositoryUri },
        AWS_ACCOUNT_ID: { value: this.account },
      },
      buildSpec: cdk.aws_codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          pre_build: { commands: [
            "aws ecr get-login-password | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com",
          ]},
          build: { commands: [
            "docker build --no-cache -t $ECR_REPO:latest .",
            "docker push $ECR_REPO:latest",
          ]},
        },
      }),
    });
    ecr.grantPullPush(buildProject);
    buildBucket.grantRead(buildProject);

    // Upload agent source to S3 for CodeBuild
    const agentSourceDeploy = new s3deploy.BucketDeployment(this, "DeployAgentSource", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../src/agents/app"))],
      destinationBucket: buildBucket, destinationKeyPrefix: "agent-build/src/agents/app",
    });

    // Custom Resource Lambda: builds Docker image and optionally updates AgentCore Runtime
    const triggerBuildFn = new lambda.Function(this, "TriggerBuildFn", {
      runtime: lambda.Runtime.PYTHON_3_12, handler: "index.handler", timeout: cdk.Duration.seconds(600), memorySize: 256,
      code: lambda.Code.fromInline(`
import boto3, json, time, urllib.request
cb = boto3.client("codebuild")
ac = boto3.client("bedrock-agentcore-control")
def handler(event, context):
    pid = "agent-build"
    try:
        if event["RequestType"] in ("Create", "Update"):
            props = event["ResourceProperties"]
            proj = props["ProjectName"]
            if props.get("SkipBuild") != "true":
                r = cb.start_build(projectName=proj)
                bid = r["build"]["id"]
                print(f"Build started: {bid}")
                for _ in range(60):
                    time.sleep(10)
                    b = cb.batch_get_builds(ids=[bid])["builds"][0]
                    s = b["buildStatus"]
                    print(f"Status: {s}")
                    if s == "SUCCEEDED": break
                    if s in ("FAILED","FAULT","STOPPED","TIMED_OUT"):
                        raise Exception(f"Build {s}")
                else:
                    raise Exception("Build timeout")
            runtime_id = props.get("RuntimeId", "")
            if runtime_id:
                env_vars = json.loads(props.get("EnvVars", "{}"))
                print(f"Updating runtime {runtime_id}")
                ac.update_agent_runtime(
                    agentRuntimeId=runtime_id,
                    agentRuntimeArtifact={"containerConfiguration":{"containerUri":props["ContainerUri"]}},
                    roleArn=props["RoleArn"],
                    networkConfiguration={"networkMode":"PUBLIC"},
                    environmentVariables=env_vars,
                )
                for _ in range(30):
                    time.sleep(10)
                    st = ac.get_agent_runtime(agentRuntimeId=runtime_id)["status"]
                    print(f"Runtime: {st}")
                    if st == "READY": break
        _send(event, "SUCCESS", pid)
    except Exception as e:
        print(e)
        _send(event, "FAILED", pid, str(e))
def _send(event, status, pid, reason="OK"):
    body = json.dumps({"Status":status,"Reason":reason,"PhysicalResourceId":pid,"StackId":event["StackId"],"RequestId":event["RequestId"],"LogicalResourceId":event["LogicalResourceId"],"Data":{}})
    urllib.request.urlopen(urllib.request.Request(event["ResponseURL"],data=body.encode(),method="PUT",headers={"Content-Type":"","Content-Length":str(len(body))}),timeout=10)
`),
    });
    triggerBuildFn.addToRolePolicy(new iam.PolicyStatement({ actions: ["codebuild:StartBuild", "codebuild:BatchGetBuilds"], resources: [buildProject.projectArn] }));
    triggerBuildFn.addToRolePolicy(new iam.PolicyStatement({ actions: ["bedrock-agentcore:UpdateAgentRuntime", "bedrock-agentcore:GetAgentRuntime"], resources: ["*"] }));
    triggerBuildFn.addToRolePolicy(new iam.PolicyStatement({ actions: ["iam:PassRole"], resources: [agentCoreRole.roleArn] }));

    // Step 1: Build image BEFORE Runtime creation (so ECR has :latest)
    const buildImage = new cdk.CustomResource(this, "BuildImage", {
      serviceToken: triggerBuildFn.functionArn,
      properties: { ProjectName: buildProject.projectName, Version: Date.now().toString() },
    });
    buildImage.node.addDependency(buildProject);
    buildImage.node.addDependency(agentSourceDeploy);

    const memory = new agentcore.CfnMemory(this, "AgentMemory", {
      name: "aiops_demo_memory",
      description: "AIOps chatbot conversation memory",
      eventExpiryDuration: 30,
      memoryStrategies: [{
        semanticMemoryStrategy: {
          name: "semanticLongTermMemory",
          namespaces: ["/strategies/{memoryStrategyId}/actors/{actorId}/"],
        },
      }],
    });

    const runtimeEnvVars = {
      KNOWLEDGE_BASE_ID: kb.attrKnowledgeBaseId, MODEL_ID: SONNET_MODEL_ID,
      AWS_REGION: this.region, AWS_DEFAULT_REGION: this.region,
      REPORTS_TABLE: reportsTable.tableName, WORKLOADS_TABLE: workloadsTable.tableName,
      MEMORY_ID: memory.attrMemoryId,
    };

    const runtime = new agentcore.CfnRuntime(this, "AgentRuntime", {
      agentRuntimeName: "aiops_demo_agent", roleArn: agentCoreRole.roleArn,
      networkConfiguration: { networkMode: "PUBLIC" },
      agentRuntimeArtifact: {
        containerConfiguration: { containerUri: `${ecr.repositoryUri}:latest` },
      },
      environmentVariables: runtimeEnvVars,
    });
    runtime.node.addDependency(ecr);
    runtime.node.addDependency(buildImage);  // ECR image must exist before Runtime creation

    new agentcore.CfnRuntimeEndpoint(this, "AgentEndpoint", {
      agentRuntimeId: runtime.attrAgentRuntimeId, name: "aiops_demo_endpoint",
    });

    // ========== Lambda: Orchestrator ==========
    const orchestrator = new lambda.Function(this, "Orchestrator", {
      functionName: "aiops-demo-orchestrator", runtime: lambda.Runtime.PYTHON_3_12, handler: "handler.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../src/lambdas/orchestrator")),
      timeout: cdk.Duration.seconds(30), memorySize: 256, reservedConcurrentExecutions: 5,
      environment: { REPORTS_TABLE: reportsTable.tableName, WORKLOADS_TABLE: workloadsTable.tableName, AGENT_RUNTIME_ARN: runtime.attrAgentRuntimeArn, MODEL_ID: SONNET_MODEL_ID },
    });
    reportsTable.grantWriteData(orchestrator); workloadsTable.grantReadData(orchestrator);
    orchestrator.addToRolePolicy(new iam.PolicyStatement({ actions: ["bedrock-agentcore:InvokeAgentRuntime", "bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream", "cloudwatch:DescribeAlarms", "ec2:Describe*", "elasticloadbalancing:Describe*", "rds:Describe*", "autoscaling:Describe*"], resources: ["*"] }));

    // ========== Lambda: API Handler ==========
    const apiHandler = new lambda.Function(this, "ApiHandler", {
      functionName: "aiops-demo-api-handler", runtime: lambda.Runtime.PYTHON_3_12, handler: "handler.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../src/lambdas/api_handler")),
      timeout: cdk.Duration.seconds(120), memorySize: 256,
      environment: { REPORTS_TABLE: reportsTable.tableName, WORKLOADS_TABLE: workloadsTable.tableName, SNAPSHOTS_TABLE: snapshotsTable.tableName, KNOWLEDGE_BUCKET: knowledgeBucket.bucketName, AGENT_RUNTIME_ARN: runtime.attrAgentRuntimeArn, KNOWLEDGE_BASE_ID: kb.attrKnowledgeBaseId, KB_DATA_SOURCE_ID: dataSource.attrDataSourceId },
    });
    reportsTable.grantReadWriteData(apiHandler); workloadsTable.grantReadWriteData(apiHandler); snapshotsTable.grantReadWriteData(apiHandler);
    knowledgeBucket.grantReadWrite(apiHandler);
    apiHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ["cloudwatch:DescribeAlarms", "bedrock-agentcore:InvokeAgentRuntime", "bedrock:StartIngestionJob", "ec2:DescribeSecurityGroupRules", "ec2:RevokeSecurityGroupIngress", "ec2:AuthorizeSecurityGroupIngress", "ec2:StopInstances", "ec2:StartInstances", "ec2:DescribeInstances", "autoscaling:DescribeAutoScalingGroups", "autoscaling:SuspendProcesses", "autoscaling:ResumeProcesses"],
      resources: ["*"],
    }));

    // ========== API Gateway ==========
    const api = new apigateway.RestApi(this, "Api", {
      restApiName: "aiops-demo-api",
      defaultCorsPreflightOptions: { allowOrigins: apigateway.Cors.ALL_ORIGINS, allowMethods: apigateway.Cors.ALL_METHODS, allowHeaders: ["Content-Type"] },
    });
    const integ = new apigateway.LambdaIntegration(apiHandler);
    const apiRes = api.root.addResource("api");
    const workloads = apiRes.addResource("workloads"); workloads.addMethod("GET", integ); workloads.addMethod("POST", integ);
    const wById = workloads.addResource("{workload_id}"); wById.addMethod("GET", integ); wById.addMethod("PUT", integ); wById.addMethod("DELETE", integ);
    wById.addResource("upload-url").addMethod("POST", integ);
    const wDocs = wById.addResource("documents"); wDocs.addMethod("GET", integ); wDocs.addMethod("DELETE", integ);
    wById.addResource("sync").addMethod("POST", integ);
    const reports = apiRes.addResource("reports"); reports.addMethod("GET", integ);
    const rById = reports.addResource("{id}"); rById.addMethod("GET", integ); rById.addMethod("DELETE", integ); rById.addResource("approve").addMethod("POST", integ);
    apiRes.addResource("status").addMethod("GET", integ);
    apiRes.addResource("chat").addMethod("POST", integ);

    // ========== WebSocket API for Chat (no timeout) ==========
    const wsHandler = new lambda.Function(this, "WsHandler", {
      functionName: "aiops-demo-ws-handler",
      runtime: lambda.Runtime.PYTHON_3_12, handler: "handler.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../src/lambdas/ws_handler")),
      timeout: cdk.Duration.seconds(300), memorySize: 256,
      environment: {
        AGENT_RUNTIME_ARN: runtime.attrAgentRuntimeArn,
        WS_ENDPOINT: "",  // Updated below after wsApi creation
      },
    });
    wsHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ["bedrock-agentcore:InvokeAgentRuntime", "execute-api:ManageConnections"], resources: ["*"],
    }));

    const wsApi = new cdk.aws_apigatewayv2.CfnApi(this, "WsApi", {
      name: "aiops-demo-ws",
      protocolType: "WEBSOCKET",
      routeSelectionExpression: "$request.body.action",
    });

    const wsIntegration = new cdk.aws_apigatewayv2.CfnIntegration(this, "WsInteg", {
      apiId: wsApi.ref,
      integrationType: "AWS_PROXY",
      integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${wsHandler.functionArn}/invocations`,
    });

    for (const route of ["$connect", "$disconnect", "sendMessage"]) {
      new cdk.aws_apigatewayv2.CfnRoute(this, `WsRoute${route.replace("$", "")}`, {
        apiId: wsApi.ref,
        routeKey: route,
        target: `integrations/${wsIntegration.ref}`,
      });
    }

    const wsStage = new cdk.aws_apigatewayv2.CfnStage(this, "WsStage", {
      apiId: wsApi.ref,
      stageName: "prod",
      autoDeploy: true,
    });

    // Grant API Gateway permission to invoke Lambda
    wsHandler.addPermission("WsApiInvoke", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${wsApi.ref}/*`,
    });

    // Set WS env vars directly (no Custom Resource needed)
    const wsUrl = `wss://${wsApi.ref}.execute-api.${this.region}.amazonaws.com/prod`;
    const wsEndpoint = `https://${wsApi.ref}.execute-api.${this.region}.amazonaws.com/prod`;
    wsHandler.addEnvironment("WS_ENDPOINT", wsEndpoint);
    apiHandler.addEnvironment("WS_URL", wsUrl);

    // ========== SQS Queue for alarm events ==========
    const alarmQueue = new sqs.Queue(this, "AlarmQueue", {
      queueName: "aiops-demo-alarm-queue",
      visibilityTimeout: cdk.Duration.seconds(60), // > Lambda timeout (30s)
      retentionPeriod: cdk.Duration.days(1),
    });

    // EventBridge → SQS
    new events.Rule(this, "AlarmRule", {
      ruleName: "aiops-demo-alarm-trigger",
      eventPattern: { source: ["aws.cloudwatch"], detailType: ["CloudWatch Alarm State Change"], detail: { state: { value: ["ALARM"] } } },
      targets: [new targets.SqsQueue(alarmQueue)],
    });

    // SQS → Lambda (1 at a time)
    orchestrator.addEventSource(new lambdaEvents.SqsEventSource(alarmQueue, { batchSize: 1, maxConcurrency: 5 }));
    orchestrator.addToRolePolicy(new iam.PolicyStatement({ actions: ["sqs:*"], resources: [alarmQueue.queueArn] }));

    // ========== CloudFront ==========
    const dist = new cloudfront.Distribution(this, "WebDist", {
      defaultBehavior: { origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket), viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS },
      additionalBehaviors: {
        "/api/*": {
        origin: new origins.HttpOrigin(`${api.restApiId}.execute-api.${this.region}.amazonaws.com`, { originPath: `/${api.deploymentStage.stageName}` }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL, viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      }},
      defaultRootObject: "index.html",
      errorResponses: [{ httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" }, { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" }],
    });

    new cdk.CfnOutput(this, "WsUrl", { value: `wss://${wsApi.ref}.execute-api.${this.region}.amazonaws.com/prod` });
    new cdk.CfnOutput(this, "ApiUrl", { value: api.url });
    new cdk.CfnOutput(this, "WebUrl", { value: `https://${dist.distributionDomainName}` });

    // ========== Deploy Web UI to S3 + CloudFront Invalidation ==========
    new s3deploy.BucketDeployment(this, "DeployWebUI", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../web-ui"), {
        bundling: {
          image: cdk.DockerImage.fromRegistry("node:18-alpine"),
          command: ["sh", "-c", "npm install && npm run build && cp -r build/* /asset-output/"],
          local: {
            tryBundle(outputDir: string) {
              require("child_process").execSync(
                "npm install && npm run build",
                { cwd: path.join(__dirname, "../../web-ui"), stdio: "inherit" }
              );
              require("child_process").execSync(
                `cp -r ${path.join(__dirname, "../../web-ui/build")}/* ${outputDir}/`
              );
              return true;
            },
          },
        },
      })],
      destinationBucket: webBucket,
      distribution: dist,
      distributionPaths: ["/*"],
    });

    // Step 2: Update Runtime env vars (after dist for WEB_URL, skips rebuild)
    const fullEnvVars = { ...runtimeEnvVars, WEB_URL: `https://${dist.distributionDomainName}` };
    const buildTrigger = new cdk.CustomResource(this, "TriggerAgentBuild", {
      serviceToken: triggerBuildFn.functionArn,
      properties: {
        ProjectName: buildProject.projectName, Version: Date.now().toString(),
        RuntimeId: runtime.attrAgentRuntimeId,
        ContainerUri: `${ecr.repositoryUri}:latest`,
        RoleArn: agentCoreRole.roleArn,
        EnvVars: JSON.stringify(fullEnvVars),
        SkipBuild: "true",
      },
    });
    buildTrigger.node.addDependency(runtime);
    new cdk.CfnOutput(this, "KnowledgeBaseId", { value: kb.attrKnowledgeBaseId });
    new cdk.CfnOutput(this, "AgentRuntimeArn", { value: runtime.attrAgentRuntimeArn });
  }
}
