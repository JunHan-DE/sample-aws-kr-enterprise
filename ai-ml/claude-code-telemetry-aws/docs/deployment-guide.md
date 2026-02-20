# 배포 가이드

이 문서는 Claude Code Observability Platform을 AWS에 배포하는 단계별 가이드입니다.

---

## 목차

1. [사전 요구사항](#1-사전-요구사항)
2. [설정 커스터마이즈](#2-설정-커스터마이즈)
3. [CDK 배포](#3-cdk-배포)
4. [배포 후 설정](#4-배포-후-설정)
5. [Grafana 대시보드 설정](#5-grafana-대시보드-설정)
6. [Claude Code 개발자 연결](#6-claude-code-개발자-연결)
7. [검증](#7-검증)
8. [스택 삭제](#8-스택-삭제)
9. [트러블슈팅](#9-트러블슈팅)

---

## 1. 사전 요구사항

### 필수 소프트웨어

| 소프트웨어 | 최소 버전 | 설치 확인 |
|-----------|----------|-----------|
| Node.js | >= 18 | `node --version` |
| npm | >= 9 | `npm --version` |
| AWS CDK CLI | >= 2.100 | `cdk --version` |
| AWS CLI | >= 2.0 | `aws --version` |
| TypeScript | >= 5.0 | `npx tsc --version` |

### AWS 계정 준비

1. **AWS CLI 자격증명 구성**

   ```bash
   aws configure
   # 또는 프로파일 지정
   aws configure --profile your-profile
   ```

2. **CDK 부트스트랩** (최초 1회)

   CDK를 사용하기 전에 대상 리전에서 부트스트랩을 수행해야 합니다.

   ```bash
   cdk bootstrap aws://ACCOUNT_ID/us-east-1
   ```

3. **AWS IAM Identity Center (SSO) 활성화**

   Amazon Managed Grafana는 AWS SSO를 통한 인증이 필요합니다. AWS 콘솔에서 IAM Identity Center를 활성화하고 사용자를 생성해야 합니다.

   - AWS Console > IAM Identity Center 이동
   - "Enable" 클릭 (아직 활성화하지 않은 경우)
   - 사용자 및 그룹 생성

### 서비스 할당량 확인

배포 전에 아래 서비스 할당량이 충분한지 확인합니다:

| 서비스 | 할당량 | 기본값 | 필요량 |
|--------|--------|--------|--------|
| VPC per Region | 5 | 5 | +1 |
| Elastic IP per Region | 5 | 5 | +1 (NAT GW) |
| ECS Fargate vCPU | - | 리전별 상이 | 최소 0.5, 최대 2.5 |
| Firehose Delivery Streams | 50 | 50 | +1 |
| AMP Workspaces | 25 | 25 | +1 |
| Managed Grafana Workspaces | 5 | 5 | +1 |

---

## 2. 설정 커스터마이즈

### 프로젝트 클론 및 의존성 설치

```bash
# 의존성 설치
cd claude-code-telemetry-aws
npm install
```

### 설정 파일 편집

`lib/config/app-config.ts`를 프로젝트 요구사항에 맞게 편집합니다:

```typescript
export const appConfig: AppConfig = {
  projectName: 'claude-code-telemetry',  // 리소스 명명 접두사
  environment: 'prod',                    // 'prod' 또는 'dev'
  region: 'us-east-1',                   // 배포 리전
  tags: {
    Project: 'claude-code-telemetry',
    ManagedBy: 'cdk',
  },
  collectorPort: 4317,                   // OTLP gRPC 포트
  collectorHttpPort: 4318,               // OTLP HTTP 포트
};
```

### 주요 설정 항목

| 항목 | 기본값 | 설명 | 변경 시 영향 |
|------|--------|------|-------------|
| `projectName` | `claude-code-telemetry` | 모든 AWS 리소스 이름의 접두사 | S3 버킷명, IAM 역할명 등 변경 |
| `environment` | `prod` | 리소스 이름 접미사 및 환경 구분 | dev로 변경 시 별도 스택 가능 |
| `region` | `us-east-1` | 모든 리소스 배포 리전 | 다른 리전 배포 가능 |
| `collectorPort` | `4317` | OTLP gRPC 수신 포트 | NLB 리스너 및 SG 규칙 변경 |
| `collectorHttpPort` | `4318` | OTLP HTTP 수신 포트 | NLB 리스너 및 SG 규칙 변경 |

---

## 3. CDK 배포

### 빌드

```bash
npm run build
```

### CloudFormation 템플릿 합성 (선택 사항)

배포 전에 생성되는 CloudFormation 템플릿을 미리 확인할 수 있습니다:

```bash
npx cdk synth
```

### 변경 사항 확인 (선택 사항)

이미 배포된 상태에서 변경 사항을 확인합니다:

```bash
npx cdk diff
```

### 전체 스택 배포

단일 루트 스택(TelemetryStack)을 배포하면 5개의 Nested Stack이 자동으로 생성됩니다:

```bash
npx cdk deploy TelemetryStack
```

배포 시 IAM 리소스 생성에 대한 확인 프롬프트가 표시됩니다. `y`를 입력하여 승인합니다.

### 배포 순서 (자동)

CloudFormation이 Nested Stack 간 의존성을 자동으로 해석하여 최적의 순서로 생성합니다:

```
Phase 1 (병렬):  NetworkNestedStack  |  MetricsNestedStack  |  EventsNestedStack
                      |                       |                      |
Phase 2 (의존성 해결 후):   CollectorNestedStack   |   DashboardNestedStack
```

### 배포 출력 확인

배포 완료 후 아래 CloudFormation 출력값을 확인합니다:

```
Outputs:
TelemetryStack.CollectorEndpoint = <NLB_DNS>:4317
TelemetryStack.CollectorHttpEndpoint = <NLB_DNS>:4318
TelemetryStack.GrafanaEndpoint = https://g-xxxxxxxxxx.grafana-workspace...
```

이 값들은 후속 설정 단계에서 필요합니다.

---

## 4. 배포 후 설정

### 4.1 Grafana SSO 사용자 할당

Amazon Managed Grafana 워크스페이스에 SSO 사용자를 할당합니다:

1. AWS Console > Amazon Managed Grafana로 이동
2. 배포된 워크스페이스 선택
3. **Authentication** 탭에서 "Configure users and user groups" 클릭
4. IAM Identity Center 사용자 또는 그룹을 추가
5. 역할 할당:
   - **Admin**: 대시보드 관리, 데이터 소스 구성
   - **Editor**: 대시보드 편집
   - **Viewer**: 대시보드 조회만

### 4.2 Grafana 데이터 소스 구성

Grafana 워크스페이스에 로그인한 후 데이터 소스를 구성합니다:

#### Prometheus (AMP) 데이터 소스

1. Grafana > Configuration > Data Sources > Add data source
2. **Prometheus** 선택
3. 설정:
   - **Name**: `AMP`
   - **UID**: `amp` (대시보드 JSON에서 참조하는 UID와 일치해야 함)
   - **URL**: CDK 출력의 AMP Query Endpoint
     - 형식: `https://aps-workspaces.us-east-1.amazonaws.com/workspaces/ws-xxxxxxxxxx`
   - **Auth**: SigV4 Auth 활성화
   - **SigV4 Auth Details**: Default Region = `us-east-1`
4. "Save & Test" 클릭

#### Athena 데이터 소스

1. Grafana > Configuration > Data Sources > Add data source
2. **Amazon Athena** 선택
3. 설정:
   - **Name**: `Athena`
   - **UID**: `athena` (대시보드 JSON에서 참조하는 UID와 일치해야 함)
   - **Athena Details**:
     - Data source: `AwsDataCatalog`
     - Database: `claude_code_telemetry`
     - Workgroup: `primary`
   - **Auth**: Default Region = `us-east-1`
4. "Save & Test" 클릭

> **중요**: 데이터 소스의 `uid` 값은 대시보드 JSON 파일에서 참조하는 값과 정확히 일치해야 합니다. AMP는 `amp`, Athena는 `athena`를 사용합니다.

---

## 5. Grafana 대시보드 설정

### 대시보드 임포트

`grafana/dashboards/` 디렉토리의 JSON 파일을 Grafana에 임포트합니다:

1. Grafana > Dashboards > Import
2. "Upload JSON file" 클릭
3. 다음 파일을 순서대로 임포트:

| 파일 | 대시보드 | 데이터 소스 |
|------|---------|------------|
| `overview.json` | Overview | AMP (Prometheus) |
| `cost.json` | Cost | AMP (Prometheus) |
| `usage.json` | Usage | AMP (Prometheus) |
| `productivity.json` | Productivity | AMP (Prometheus) |
| `tool-analytics.json` | Tool Analytics | Athena |
| `api-performance.json` | API Performance | Athena |

4. 임포트 시 데이터 소스를 올바르게 매핑합니다:
   - Prometheus 관련: `AMP` 데이터 소스 선택
   - Athena 관련: `Athena` 데이터 소스 선택

### 대시보드 확인

임포트 후 각 대시보드에서 다음을 확인합니다:
- 데이터 소스 연결이 정상인지 (오류 메시지 없음)
- 템플릿 변수(team, user, model, tool)가 작동하는지
- 대시보드 간 네비게이션 링크가 작동하는지

> **참고**: 데이터가 수집되기 전까지는 "No data" 상태가 정상입니다.

---

## 6. Claude Code 개발자 연결

### 기본 환경변수 설정

개발자 PC에서 아래 환경변수를 설정합니다:

```bash
# 텔레메트리 활성화
export CLAUDE_CODE_ENABLE_TELEMETRY=1

# 메트릭 및 이벤트 OTLP 내보내기 활성화
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp

# 프로토콜 및 엔드포인트 설정
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://<NLB_DNS>:4317
```

`<NLB_DNS>`를 CDK 배포 출력의 `TelemetryStack.CollectorEndpoint`에서 확인한 NLB DNS 이름으로 교체합니다.

### 팀/부서 구분이 필요한 경우

```bash
export OTEL_RESOURCE_ATTRIBUTES="department=engineering,team.id=platform,cost_center=eng-100"
```

### 영구 설정

`~/.zshrc` 또는 `~/.bashrc`에 추가하여 영구 적용합니다:

```bash
# Claude Code Telemetry
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://<NLB_DNS>:4317
export OTEL_RESOURCE_ATTRIBUTES="department=engineering,team.id=my-team"
```

> 개발자 설정에 대한 상세한 가이드는 [claude-code-setup-guide.md](claude-code-setup-guide.md)를 참조하세요.

---

## 7. 검증

### 7.1 인프라 검증

```bash
# ECS 서비스 상태 확인
aws ecs describe-services \
  --cluster claude-code-telemetry-collector-prod \
  --services claude-code-telemetry-collector-svc-prod \
  --query 'services[0].{status:status, runningCount:runningCount, desiredCount:desiredCount}'

# NLB 타겟 그룹 헬스 체크 확인
aws elbv2 describe-target-health \
  --target-group-arn <TARGET_GROUP_ARN>

# Firehose 스트림 상태 확인
aws firehose describe-delivery-stream \
  --delivery-stream-name claude-code-telemetry-events-stream-prod \
  --query 'DeliveryStreamDescription.DeliveryStreamStatus'
```

### 7.2 데이터 수신 검증

1. **메트릭 확인**: Grafana에서 AMP 데이터 소스를 사용하여 아래 PromQL 실행:

   ```promql
   claude_code_session_count
   ```

   값이 반환되면 메트릭 파이프라인이 정상입니다.

2. **이벤트 확인**: Grafana에서 Athena 데이터 소스 또는 AWS 콘솔의 Athena에서:

   ```sql
   SELECT COUNT(*) FROM claude_code_telemetry.events LIMIT 10;
   ```

   결과가 반환되면 이벤트 파이프라인이 정상입니다.

3. **CW Logs 확인**: ADOT Collector의 이벤트가 CloudWatch Logs에 기록되는지 확인:

   ```bash
   aws logs filter-log-events \
     --log-group-name /claude-code/telemetry-events \
     --limit 5
   ```

4. **S3 파일 확인**:

   ```bash
   aws s3 ls s3://<EVENTS_BUCKET>/ --recursive | head -20
   ```

### 7.3 엔드투엔드 테스트

1. 개발자 PC에서 환경변수 설정
2. `claude` 명령 실행 후 간단한 작업 수행
3. 60초 이상 대기 (메트릭 내보내기 주기)
4. Grafana Overview 대시보드에서 세션 카운트 증가 확인
5. 5분 이상 대기 (Firehose 버퍼링)
6. Grafana Tool Analytics 대시보드에서 도구 사용 데이터 확인

---

## 8. 스택 삭제

> **주의**: S3 버킷은 `RETAIN` 정책으로 인해 스택 삭제 시 보존됩니다. 완전 삭제가 필요한 경우 수동으로 S3 버킷을 비우고 삭제해야 합니다.

```bash
# 단일 스택 삭제 (모든 Nested Stack 자동 삭제)
npx cdk destroy TelemetryStack

# S3 버킷 수동 삭제 (필요 시)
aws s3 rb s3://<EVENTS_BUCKET> --force
```

Nested Stack 구조이므로 루트 스택 1개만 삭제하면 모든 하위 스택이 역순으로 자동 정리됩니다.

---

## 9. 트러블슈팅

### ECS 태스크가 시작되지 않는 경우

```bash
# 태스크 중지 사유 확인
aws ecs describe-tasks \
  --cluster claude-code-telemetry-collector-prod \
  --tasks <TASK_ARN> \
  --query 'tasks[0].stoppedReason'

# 태스크 로그 확인
aws logs get-log-events \
  --log-group-name /ecs/claude-code-telemetry-collector-prod \
  --log-stream-name <LOG_STREAM>
```

**일반적인 원인:**
- NAT Gateway가 없어 ECR 이미지를 풀링할 수 없음
- Task Role에 필요한 IAM 권한이 부족
- ADOT config YAML 구문 오류

> **참고**: ADOT Collector v0.40.0은 scratch 기반 이미지로, ECS 컨테이너 레벨 헬스체크(CMD-SHELL 등)를 사용할 수 없습니다. NLB Target Group HTTP 헬스체크(포트 13133)만 사용해야 합니다.

### Firehose에서 S3로 데이터가 전달되지 않는 경우

```bash
# Firehose 오류 로그 확인
aws logs filter-log-events \
  --log-group-name /aws/firehose/claude-code-telemetry-events-stream-prod \
  --limit 10

# Lambda Transformer 로그 확인
aws logs filter-log-events \
  --log-group-name /aws/lambda/claude-code-telemetry-firehose-transformer-prod \
  --limit 10
```

**일반적인 원인:**
- Glue 테이블 스키마와 입력 데이터 불일치
- Lambda Transformer에서 CW Logs 엔벨로프 디코딩 실패
- Firehose IAM Role에 S3 또는 Glue 권한 부족
- S3 `errors/` 프리픽스에 실패한 레코드가 라우팅되어 있을 수 있음

### CW Logs에 이벤트가 기록되지 않는 경우

1. ADOT Collector 컨테이너 로그에서 `awscloudwatchlogs` exporter 관련 오류 확인
2. ECS Task Role에 CloudWatch Logs 관련 권한(`logs:PutLogEvents`, `logs:CreateLogStream` 등)이 있는지 확인
3. 로그 그룹 `/claude-code/telemetry-events`가 존재하는지 확인

### Grafana에서 AMP 데이터가 표시되지 않는 경우

1. 데이터 소스 설정에서 SigV4 인증이 활성화되어 있는지 확인
2. AMP 워크스페이스 URL이 정확한지 확인 (끝에 `/` 제거)
3. Grafana IAM Role에 `aps:QueryMetrics` 권한이 있는지 확인

### Grafana에서 Athena 쿼리가 실패하는 경우

1. Athena 워크그룹이 `primary`인지 확인
2. Grafana IAM Role에 Athena, Glue, S3 권한이 있는지 확인
3. Athena 쿼리 결과 S3 버킷 (`aws-athena-query-results-*`)에 대한 쓰기 권한 확인

### NLB 타겟 그룹이 Unhealthy인 경우

1. ECS 태스크가 정상 실행 중인지 확인
2. Security Group에서 포트 13133 인바운드가 VPC CIDR 범위 내에서 허용되어 있는지 확인
3. ADOT Collector 컨테이너 로그에서 health_check extension 관련 오류 확인

---

---

# Deployment Guide (English)

This document provides a step-by-step guide for deploying the Claude Code Observability Platform on AWS.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Configuration](#configuration)
3. [CDK Deployment](#cdk-deployment)
4. [Post-Deployment Setup](#post-deployment-setup)
5. [Grafana Dashboard Setup](#grafana-dashboard-setup)
6. [Connect Claude Code Developers](#connect-claude-code-developers)
7. [Verification](#verification)
8. [Stack Deletion](#stack-deletion)
9. [Troubleshooting](#troubleshooting-1)

---

## Prerequisites

### Required Software

| Software | Minimum Version | Check Command |
|----------|----------------|---------------|
| Node.js | >= 18 | `node --version` |
| npm | >= 9 | `npm --version` |
| AWS CDK CLI | >= 2.100 | `cdk --version` |
| AWS CLI | >= 2.0 | `aws --version` |
| TypeScript | >= 5.0 | `npx tsc --version` |

### AWS Account Preparation

1. **Configure AWS CLI credentials**

   ```bash
   aws configure
   ```

2. **CDK Bootstrap** (one-time)

   ```bash
   cdk bootstrap aws://ACCOUNT_ID/us-east-1
   ```

3. **Enable AWS IAM Identity Center (SSO)**

   Amazon Managed Grafana requires SSO authentication. Enable IAM Identity Center in the AWS Console and create users.

---

## Configuration

Edit `lib/config/app-config.ts`:

```typescript
export const appConfig: AppConfig = {
  projectName: 'claude-code-telemetry',  // Resource naming prefix
  environment: 'prod',                    // 'prod' or 'dev'
  region: 'us-east-1',                   // Deployment region
  tags: {
    Project: 'claude-code-telemetry',
    ManagedBy: 'cdk',
  },
  collectorPort: 4317,                   // OTLP gRPC port
  collectorHttpPort: 4318,               // OTLP HTTP port
};
```

---

## CDK Deployment

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Preview CloudFormation templates (optional)
npx cdk synth

# Deploy the stack (single command deploys all 5 nested stacks)
npx cdk deploy TelemetryStack
```

### Stack Architecture

The project uses a single root stack with 5 nested stacks:

```
TelemetryStack (root)
  +-- NetworkNestedStack      (VPC, Subnets, NAT GW, Security Groups)
  +-- MetricsNestedStack      (AMP Workspace)
  +-- EventsNestedStack       (S3, Glue, Firehose, Lambda, CW Logs, Sub Filter)
  +-- CollectorNestedStack    (ECS, NLB, Target Groups, Auto-scaling)
  +-- DashboardNestedStack    (Managed Grafana)
```

### Deployment Order (automatic)

CloudFormation automatically resolves dependencies:

```
Phase 1 (parallel):  NetworkNestedStack | MetricsNestedStack | EventsNestedStack
Phase 2:             CollectorNestedStack + DashboardNestedStack
```

### Deployment Outputs

After deployment, note the following outputs:

| Output | Description |
|--------|-------------|
| `TelemetryStack.CollectorEndpoint` | NLB DNS for OTLP gRPC (:4317) |
| `TelemetryStack.CollectorHttpEndpoint` | NLB DNS for OTLP HTTP (:4318) |
| `TelemetryStack.GrafanaEndpoint` | Grafana Workspace URL |

---

## Post-Deployment Setup

### Assign Grafana SSO Users

1. AWS Console > Amazon Managed Grafana
2. Select the deployed workspace
3. Authentication tab > "Configure users and user groups"
4. Add IAM Identity Center users/groups
5. Assign roles: Admin, Editor, or Viewer

### Configure Grafana Data Sources

#### Prometheus (AMP)

- **Name**: `AMP`, **UID**: `amp`
- **URL**: AMP Query Endpoint from CDK output
- Enable **SigV4 Auth**, set region to `us-east-1`

#### Athena

- **Name**: `Athena`, **UID**: `athena`
- **Catalog**: `AwsDataCatalog`, **Database**: `claude_code_telemetry`, **Workgroup**: `primary`
- Set region to `us-east-1`

> **Important**: Data source UIDs must match those referenced in dashboard JSON files (`amp` and `athena`).

---

## Grafana Dashboard Setup

Import the 6 dashboard JSON files from `grafana/dashboards/`:

| File | Dashboard | Data Source |
|------|-----------|-------------|
| `overview.json` | Overview | AMP |
| `cost.json` | Cost | AMP |
| `usage.json` | Usage | AMP |
| `productivity.json` | Productivity | AMP |
| `tool-analytics.json` | Tool Analytics | Athena |
| `api-performance.json` | API Performance | Athena |

1. Grafana > Dashboards > Import > Upload JSON file
2. Map data sources correctly during import

---

## Connect Claude Code Developers

Set environment variables on developer PCs:

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://<NLB_DNS>:4317
```

Replace `<NLB_DNS>` with the NLB DNS name from `TelemetryStack.CollectorEndpoint`.

For team/department identification:

```bash
export OTEL_RESOURCE_ATTRIBUTES="department=engineering,team.id=platform,cost_center=eng-100"
```

> For detailed developer setup, see [claude-code-setup-guide.md](claude-code-setup-guide.md).

---

## Verification

1. **Infrastructure**: Check ECS service status, NLB target health, Firehose stream status
2. **Metrics**: Run `claude_code_session_count` PromQL query in Grafana
3. **CW Logs**: Check `/claude-code/telemetry-events` log group for events
4. **Events**: Run `SELECT COUNT(*) FROM claude_code_telemetry.events` in Athena
5. **End-to-end**: Run Claude Code, wait 60s for metrics and 5 min for events, check dashboards

---

## Stack Deletion

```bash
# Delete the root stack (all nested stacks auto-deleted)
npx cdk destroy TelemetryStack

# Manually delete retained S3 bucket (if needed)
aws s3 rb s3://<EVENTS_BUCKET> --force
```

> **Note**: The S3 bucket is retained on stack deletion (RETAIN policy). Manual deletion is required for complete cleanup. With Nested Stack architecture, deleting the root stack automatically removes all child stacks in reverse dependency order.

---

## Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| ECS task won't start | NAT Gateway issue, IAM permissions, or ADOT scratch image incompatibility with container health check | Check stopped reason, task logs. Do not use CMD-SHELL health check with ADOT scratch image |
| No data in CW Logs | ADOT `awscloudwatchlogs` exporter misconfigured or Task Role missing CW Logs permissions | Check ADOT container logs, verify IAM permissions |
| No data in S3 | Lambda Transformer error, Firehose schema mismatch, or IAM | Check Lambda & Firehose CloudWatch error logs, check S3 `errors/` prefix |
| Grafana can't query AMP | SigV4 auth not enabled | Enable SigV4, verify workspace URL |
| Athena query fails | Missing IAM permissions | Verify Grafana role has Athena/Glue/S3 access |
| NLB targets unhealthy | SG blocking port 13133 | Verify security group allows health check port from VPC CIDR |
