# Nested Stack 통합 설계서

**작성자:** Cloud Architect
**작성일:** 2026-02-19
**대상:** Claude Code Telemetry AWS CDK 프로젝트 - 5개 독립 스택을 단일 루트 스택 + Nested Stack 구조로 통합

---

## 목차

1. [배경 및 동기](#1-배경-및-동기)
2. [현재 구조 분석](#2-현재-구조-분석)
3. [Nested Stack 설계](#3-nested-stack-설계)
4. [스택 간 의존성 및 파라미터 전달](#4-스택-간-의존성-및-파라미터-전달)
5. [CollectorStack 배포 시간 분석 및 최적화](#5-collectorstack-배포-시간-분석-및-최적화)
6. [Lambda Transformer 검증](#6-lambda-transformer-검증)
7. [구현 가이드](#7-구현-가이드)
8. [마이그레이션 전략](#8-마이그레이션-전략)

---

## 1. 배경 및 동기

### 1.1 현재 문제점

현재 5개의 독립적인 CloudFormation 스택이 배포되어 있다:

| 스택 | 리소스 수 (예상) | 역할 |
|------|-----------------|------|
| NetworkStack | ~10 | VPC, 서브넷, NAT GW, SG, Flow Logs |
| MetricsStack | ~3 | AMP Workspace |
| EventsStack | ~15 | S3, Glue, Firehose, Lambda, CW Logs, Subscription Filter |
| CollectorStack | ~20 | ECS Cluster, Task Def, Service, NLB, Target Groups, IAM |
| DashboardStack | ~5 | Managed Grafana, IAM |

**독립 스택 방식의 문제점:**

1. **배포 복잡도**: `cdk deploy --all` 또는 순서를 지키며 개별 배포 필요. 의존성 순서를 잘못 지정하면 실패 가능
2. **크로스 스택 참조 잠금(Lock-in)**: CloudFormation Export/Import로 연결된 출력값은 소비 스택이 존재하는 한 수정/삭제 불가. 스키마 변경 시 양쪽 스택을 동시에 업데이트하기 어려움
3. **운영 오버헤드**: 5개 스택 각각의 상태를 CloudFormation 콘솔에서 추적해야 함. 롤백 시 스택 간 일관성 보장이 어려움
4. **삭제 복잡도**: 의존성 역순으로 삭제해야 하며, 크로스 스택 참조가 남아 있으면 삭제 실패
5. **리소스 합계**: 전체 ~53개 리소스로 단일 CloudFormation 스택 한도(500개)의 약 10% -- Nested Stack으로도 충분히 관리 가능

### 1.2 Nested Stack 통합의 이점

1. **단일 배포 단위**: `cdk deploy TelemetryStack` 한 번으로 전체 인프라 배포/업데이트
2. **크로스 스택 참조 제거**: Nested Stack 간 값 전달은 CloudFormation `Ref`/`Fn::GetAtt`로 해결. Export/Import 잠금 없음
3. **원자적 롤백**: 루트 스택 배포 실패 시 전체 Nested Stack이 함께 롤백되어 일관성 보장
4. **운영 단순화**: CloudFormation 콘솔에서 루트 스택 1개만 추적. Nested Stack은 하위 항목으로 확인
5. **삭제 단순화**: 루트 스택 1개만 삭제하면 모든 Nested Stack이 역순으로 정리됨

### 1.3 전제조건

- 기존 5개 스택은 **모두 삭제된 상태**이므로, 마이그레이션이 아닌 신규 배포로 진행
- S3 버킷 중 `RETAIN` 정책이 적용된 것은 스택 삭제 후에도 물리적으로 남아 있을 수 있으므로, 버킷 이름 충돌을 방지하기 위해 CDK 자동 생성 이름 사용 권장

---

## 2. 현재 구조 분석

### 2.1 스택 의존성 그래프

```
NetworkStack          MetricsStack          EventsStack
(VPC, SG)            (AMP)                 (S3, Firehose, Glue,
    |                    |                  Lambda, CW Logs,
    |                    |                  Subscription Filter)
    |                    |                       |
    +--------------------+-----------+-----------+
                         |           |
                         v           v
                   CollectorStack         DashboardStack
                   (ECS, NLB,            (Grafana, IAM)
                    Auto-scaling,
                    IAM)
```

### 2.2 크로스 스택 데이터 흐름

| 소스 | 전달 값 | 소비자 |
|------|---------|--------|
| NetworkStack | `vpc` (IVpc) | CollectorStack |
| NetworkStack | `collectorSecurityGroup` (ISecurityGroup) | CollectorStack |
| MetricsStack | `workspaceArn` (string) | CollectorStack, DashboardStack |
| MetricsStack | `remoteWriteUrl` (string) | CollectorStack |
| MetricsStack | `workspaceId` (string) | DashboardStack |
| EventsStack | `logGroupName` (string) | CollectorStack |
| EventsStack | `logGroupArn` (string) | CollectorStack |
| EventsStack | `glueDatabaseName` (string) | DashboardStack |
| EventsStack | `eventsBucketArn` (string) | DashboardStack |

### 2.3 현재 코드 구조

```
bin/
  app.ts                          # 엔트리포인트 - 5개 Stack 인스턴스화
lib/
  config/
    app-config.ts                 # AppConfig 인터페이스, resourceName/shortResourceName 유틸
  stacks/
    network-stack.ts              # VPC, SG, Flow Logs
    metrics-stack.ts              # AMP Workspace
    events-stack.ts               # S3, Glue, Firehose, Lambda, CW Logs, Sub Filter
    collector-stack.ts            # ECS, NLB, Target Groups, Auto-scaling, IAM
    dashboard-stack.ts            # Managed Grafana, IAM
config/
  adot-collector-config.yaml      # ADOT Collector YAML (AOT_CONFIG_CONTENT로 주입)
lambda/
  firehose-transformer/
    index.py                      # CW Logs 엔벨로프 -> 평면 JSON 변환 Lambda
```

---

## 3. Nested Stack 설계

### 3.1 목표 구조

```
TelemetryStack (루트 스택)
  |
  +-- NetworkNestedStack         (NestedStack)
  +-- MetricsNestedStack         (NestedStack)
  +-- EventsNestedStack          (NestedStack)
  +-- CollectorNestedStack       (NestedStack)
  +-- DashboardNestedStack       (NestedStack)
```

### 3.2 CDK 클래스 매핑

| 현재 | 변경 후 | 상속 클래스 |
|------|---------|------------|
| `class NetworkStack extends cdk.Stack` | `class NetworkNestedStack extends cdk.NestedStack` | `cdk.NestedStack` |
| `class MetricsStack extends cdk.Stack` | `class MetricsNestedStack extends cdk.NestedStack` | `cdk.NestedStack` |
| `class EventsStack extends cdk.Stack` | `class EventsNestedStack extends cdk.NestedStack` | `cdk.NestedStack` |
| `class CollectorStack extends cdk.Stack` | `class CollectorNestedStack extends cdk.NestedStack` | `cdk.NestedStack` |
| `class DashboardStack extends cdk.Stack` | `class DashboardNestedStack extends cdk.NestedStack` | `cdk.NestedStack` |
| (신규) | `class TelemetryStack extends cdk.Stack` | `cdk.Stack` (루트) |

### 3.3 파일 구조 변경

```
bin/
  app.ts                          # TelemetryStack 단일 인스턴스화
lib/
  config/
    app-config.ts                 # 변경 없음
  telemetry-stack.ts              # 루트 스택 (Nested Stack 오케스트레이션)
  nested-stacks/                  # stacks/ -> nested-stacks/ 리네이밍
    network-stack.ts              # extends NestedStack
    metrics-stack.ts              # extends NestedStack
    events-stack.ts               # extends NestedStack
    collector-stack.ts            # extends NestedStack
    dashboard-stack.ts            # extends NestedStack
```

### 3.4 루트 스택 설계

`lib/telemetry-stack.ts`:

```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AppConfig } from './config/app-config.js';
import { NetworkNestedStack } from './nested-stacks/network-stack.js';
import { MetricsNestedStack } from './nested-stacks/metrics-stack.js';
import { EventsNestedStack } from './nested-stacks/events-stack.js';
import { CollectorNestedStack } from './nested-stacks/collector-stack.js';
import { DashboardNestedStack } from './nested-stacks/dashboard-stack.js';

export interface TelemetryStackProps extends cdk.StackProps {
  readonly config: AppConfig;
}

export class TelemetryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TelemetryStackProps) {
    super(scope, id, props);

    const { config } = props;

    // 의존성 없는 스택들 (병렬 생성)
    const network = new NetworkNestedStack(this, 'Network', { config });
    const metrics = new MetricsNestedStack(this, 'Metrics', { config });
    const events = new EventsNestedStack(this, 'Events', { config });

    // CollectorNestedStack: Network + Metrics + Events에 의존
    const collector = new CollectorNestedStack(this, 'Collector', {
      config,
      vpc: network.vpc,
      collectorSecurityGroup: network.collectorSecurityGroup,
      ampWorkspaceArn: metrics.workspaceArn,
      ampRemoteWriteUrl: metrics.remoteWriteUrl,
      logGroupName: events.logGroupName,
      logGroupArn: events.logGroupArn,
    });

    // DashboardNestedStack: Metrics + Events에 의존
    const dashboard = new DashboardNestedStack(this, 'Dashboard', {
      config,
      ampWorkspaceArn: metrics.workspaceArn,
      ampWorkspaceId: metrics.workspaceId,
      glueDatabaseName: events.glueDatabaseName,
      eventsBucketArn: events.eventsBucketArn,
    });

    // 루트 스택 출력값 (운영에 필요한 핵심 엔드포인트)
    new cdk.CfnOutput(this, 'CollectorEndpoint', {
      value: `${collector.nlbDnsName}:${config.collectorPort}`,
      description: 'OTLP gRPC Collector Endpoint',
    });

    new cdk.CfnOutput(this, 'GrafanaEndpoint', {
      value: `https://${dashboard.grafanaEndpoint}`,
      description: 'Grafana Workspace URL',
    });
  }
}
```

### 3.5 엔트리포인트 변경

`bin/app.ts`:

```typescript
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
```

### 3.6 Nested Stack Props 변경 패턴

각 Nested Stack의 Props 인터페이스에서 `cdk.StackProps`를 `cdk.NestedStackProps`로 변경:

```typescript
// 변경 전
export interface NetworkStackProps extends cdk.StackProps {
  readonly config: AppConfig;
}

// 변경 후
export interface NetworkNestedStackProps extends cdk.NestedStackProps {
  readonly config: AppConfig;
}
```

### 3.7 네이밍 컨벤션 유지

기존 `resourceName()` 및 `shortResourceName()` 유틸리티 함수는 변경 없이 유지한다. Nested Stack 내부의 리소스 이름은 동일하게 생성된다.

**주의**: `cdk.NestedStack` 에서는 `this.account`와 `this.region`이 루트 스택의 값을 그대로 상속하므로, 기존 코드의 `this.account`, `config.region` 참조는 모두 정상 동작한다.

---

## 4. 스택 간 의존성 및 파라미터 전달

### 4.1 Nested Stack에서의 의존성 처리

**핵심 차이점**: 독립 스택에서는 `collectorStack.addDependency(networkStack)`으로 명시적 의존성을 선언했지만, Nested Stack 구조에서는 **CDK가 자동으로 의존성을 추론한다.**

`CollectorNestedStack`의 Props에 `network.vpc`를 전달하면, CDK는 이 값이 `NetworkNestedStack`에서 생성된 리소스임을 인식하고 자동으로 의존성을 설정한다. 따라서 `addDependency()` 호출이 불필요하다.

### 4.2 값 전달 메커니즘

Nested Stack 간 값 전달은 두 가지 방식으로 이루어진다:

**방식 1: L2 Construct 객체 직접 전달 (권장)**

```typescript
// NetworkNestedStack에서 VPC 객체를 public으로 노출
public readonly vpc: ec2.IVpc;

// TelemetryStack에서 직접 전달
const collector = new CollectorNestedStack(this, 'Collector', {
  vpc: network.vpc,  // IVpc 객체를 그대로 전달
});
```

CDK가 내부적으로 CloudFormation 파라미터와 `Fn::GetAtt`를 사용하여 Nested Stack 템플릿 간 참조를 자동 생성한다. 개발자는 이 과정을 의식할 필요 없다.

**방식 2: String 값 전달**

```typescript
// MetricsNestedStack에서 ARN 문자열을 public으로 노출
public readonly workspaceArn: string;

// TelemetryStack에서 전달
const collector = new CollectorNestedStack(this, 'Collector', {
  ampWorkspaceArn: metrics.workspaceArn,  // string 전달
});
```

이 경우에도 CDK가 CloudFormation 토큰(`${Token[...]}`)으로 처리하여 배포 시점에 실제 값으로 해석된다.

### 4.3 전체 파라미터 흐름도

```
NetworkNestedStack                MetricsNestedStack              EventsNestedStack
  |                                |                                |
  +-> vpc (IVpc) -------+          +-> workspaceArn -----+--+       +-> logGroupName ----+
  +-> collectorSG -----+|          +-> remoteWriteUrl ---+  |       +-> logGroupArn -----+
                        ||          +-> workspaceId -----|--+|       +-> glueDatabaseName |--+
                        ||                               |  ||       +-> eventsBucketArn  |  |
                        ||                               |  ||                            |  |
                        vv                               v  vv                            v  v
                  CollectorNestedStack                DashboardNestedStack
                  (vpc, sg, ampArn,                   (ampArn, ampId,
                   ampUrl, logName,                    glueDb, bucketArn)
                   logArn)
```

### 4.4 CfnOutput 전략

Nested Stack 내부의 `CfnOutput`은 CloudFormation 콘솔에서 해당 Nested Stack의 Outputs 탭에 표시된다. 운영에 자주 필요한 핵심 출력값(Collector Endpoint, Grafana URL)은 루트 스택에서도 `CfnOutput`으로 노출하여 빠르게 확인할 수 있도록 한다.

---

## 5. CollectorStack 배포 시간 분석 및 최적화

### 5.1 배포 시간 구성 요소

CollectorStack(CollectorNestedStack)은 전체 배포에서 가장 오래 걸리는 스택이다. 주요 원인:

| 리소스 | 예상 생성 시간 | 원인 |
|--------|--------------|------|
| ECS Cluster | ~30초 | Container Insights V2 활성화 포함 |
| NLB | 2~4분 | ENI 생성, DNS 등록, AZ별 네트워크 인터페이스 프로비저닝 |
| NLB Target Group | ~30초 | 타겟 그룹 자체는 빠르나 헬스체크 설정 검증 포함 |
| ECS Service | 3~7분 | **가장 느림** -- 아래 상세 분석 참조 |
| Auto Scaling | ~30초 | 스케일링 정책 등록 |
| **합계** | **7~13분** | |

### 5.2 ECS Fargate Service 생성 시간 상세 분석

ECS Fargate Service 생성이 느린 이유는 CloudFormation이 서비스를 `CREATE_COMPLETE`로 표시하기 전에 **서비스 안정화(Service Stabilization)**를 기다리기 때문이다:

1. **태스크 시작** (~1분): Fargate 용량 확보, ENI 할당, 컨테이너 이미지 풀, 컨테이너 시작
2. **컨테이너 헬스체크 통과** (~1~2분): `startPeriod`(30초) 후 첫 헬스체크 시도, `interval`(30초) x 최소 1회 성공 필요
3. **NLB Target Group 헬스체크 통과** (~1~3분): NLB TG 헬스체크 `interval`(30초) x `healthyThresholdCount`(3회) = 최소 90초 대기
4. **서비스 안정화 확인** (~1~2분): ECS가 `desiredCount`만큼의 태스크가 RUNNING이고 헬스체크를 통과한 상태가 `steadyStateGracePeriodSeconds` 동안 유지되는지 확인

이 모든 단계가 순차적으로 진행되므로, 최악의 경우 7분 이상 소요될 수 있다.

### 5.3 최적화 방안

#### 5.3.1 NLB Target Group 헬스체크 튜닝

**현재 설정:**
```typescript
healthCheck: {
  protocol: elbv2.Protocol.HTTP,
  port: String(HEALTH_CHECK_PORT),
  path: '/',
  healthyThresholdCount: 3,    // 3회 연속 성공 필요
  unhealthyThresholdCount: 3,
  interval: cdk.Duration.seconds(30),
}
```

**최적화 설정:**
```typescript
healthCheck: {
  protocol: elbv2.Protocol.HTTP,
  port: String(HEALTH_CHECK_PORT),
  path: '/',
  healthyThresholdCount: 2,    // 2회로 축소 (NLB TG에서 허용하는 최솟값)
  unhealthyThresholdCount: 2,
  interval: cdk.Duration.seconds(10), // 30초 -> 10초 (NLB TG에서 허용하는 최솟값)
}
```

**효과**: 헬스체크 통과 시간이 `30초 x 3회 = 90초`에서 `10초 x 2회 = 20초`로 약 70초 단축.

**NLB Target Group 헬스체크 제약사항**: NLB Target Group은 `interval` 최솟값이 10초, `healthyThresholdCount` 최솟값이 2이다 (ALB와 다름). 이 값으로 설정하면 초기 배포 시간을 유의미하게 줄일 수 있다.

#### 5.3.2 ECS 컨테이너 헬스체크 튜닝

**현재 설정:**
```typescript
healthCheck: {
  command: ['CMD-SHELL', `wget --spider -q http://localhost:${HEALTH_CHECK_PORT}/ || exit 1`],
  interval: cdk.Duration.seconds(30),
  timeout: cdk.Duration.seconds(5),
  retries: 3,
  startPeriod: cdk.Duration.seconds(30),
}
```

**최적화 설정:**
```typescript
healthCheck: {
  command: ['CMD-SHELL', `wget --spider -q http://localhost:${HEALTH_CHECK_PORT}/ || exit 1`],
  interval: cdk.Duration.seconds(15),   // 30초 -> 15초
  timeout: cdk.Duration.seconds(5),
  retries: 2,                            // 3회 -> 2회
  startPeriod: cdk.Duration.seconds(15), // 30초 -> 15초 (ADOT는 빠르게 시작)
}
```

**효과**: ADOT Collector는 일반적으로 5~10초 내에 health_check 엔드포인트가 응답 가능하다. `startPeriod`를 15초로 줄이고, `retries`를 2회로 줄여 초기 안정화 시간을 단축할 수 있다.

#### 5.3.3 Target Group Deregistration Delay 설정

**현재**: 기본값 300초 (5분)

**최적화:**
```typescript
const grpcTargetGroup = new elbv2.NetworkTargetGroup(this, 'GrpcTargetGroup', {
  // ... 기존 설정 ...
  deregistrationDelay: cdk.Duration.seconds(30), // 300초 -> 30초
});
```

**효과**: 롤링 업데이트 시 이전 태스크가 5분 동안 연결을 유지하며 대기하는 시간을 30초로 줄인다. 텔레메트리 데이터는 재전송이 가능하므로(OTel SDK의 retry 메커니즘) 연결 유지 시간을 짧게 설정해도 데이터 유실 위험이 낮다.

#### 5.3.4 ECS 배포 서킷 브레이커 추가

```typescript
const service = new ecs.FargateService(this, 'CollectorService', {
  // ... 기존 설정 ...
  circuitBreaker: { rollback: true }, // 배포 실패 시 자동 롤백
});
```

**효과**: 새 태스크 정의 배포가 실패하면 CloudFormation이 무한히 대기하지 않고 자동으로 이전 버전으로 롤백한다. 배포 시간 자체를 줄이지는 않지만, 실패 시 빠른 복구가 가능하다.

### 5.4 최적화 전후 예상 시간 비교

| 단계 | 최적화 전 | 최적화 후 |
|------|----------|----------|
| ECS Cluster 생성 | ~30초 | ~30초 (변경 없음) |
| NLB 생성 | 2~4분 | 2~4분 (변경 없음) |
| 태스크 시작 | ~1분 | ~1분 (변경 없음) |
| 컨테이너 헬스체크 통과 | ~1.5분 | ~45초 |
| NLB TG 헬스체크 통과 | ~1.5분 | ~20초 |
| 서비스 안정화 | ~1분 | ~30초 |
| **합계** | **7~10분** | **5~7분** |

약 2~3분 단축 효과가 예상된다. NLB 생성 자체는 AWS 인프라 레벨에서 시간이 소요되므로 최적화가 불가능하다.

---

## 6. Lambda Transformer 검증

### 6.1 현재 파이프라인 아키텍처

현재 이벤트 파이프라인은 Option B 방식을 사용하며, Lambda transformer를 통해 데이터 형식 변환을 수행한다:

```
ADOT Collector
    | awscloudwatchlogs exporter
    v
CloudWatch Logs (1일 보존)
    | Subscription Filter
    v
Kinesis Data Firehose
    | Processing: Lambda transformer
    | DataFormatConversion: JSON -> Parquet (Glue 스키마 참조)
    v
S3 (Parquet, Snappy, Hive 파티셔닝)
```

### 6.2 Lambda Transformer 코드 분석

`lambda/firehose-transformer/index.py`의 처리 흐름:

```
Firehose 레코드 (Base64)
    |
    v (1) base64 디코딩
gzip 압축 바이너리
    |
    v (2) gzip 해제
CW Logs 엔벨로프 JSON
{
  "messageType": "DATA_MESSAGE",
  "logGroup": "/claude-code/telemetry-events",
  "logEvents": [
    { "id": "...", "timestamp": ..., "message": "{OTLP JSON}" }
  ]
}
    |
    v (3) CONTROL_MESSAGE 필터링 (Dropped)
    |
    v (4) logEvents[].message 추출
OTLP JSON 문자열
    |
    v (5) parse_otlp_log() - OTLP JSON -> 평면 JSON 변환
평면 JSON (Glue 스키마 호환)
{
  "event_name": "api_request",
  "session_id": "abc-123",
  "cost_usd": 0.05,
  ...
}
    |
    v (6) 각 레코드를 newline-delimited JSON으로 결합 + Base64 인코딩
Firehose 출력 레코드
```

### 6.3 검증 결과

#### 6.3.1 CW Logs 엔벨로프 처리: 적절

Lambda가 CW Logs Subscription Filter의 base64 + gzip 엔벨로프를 올바르게 처리한다. `CONTROL_MESSAGE` 필터링도 적절하다. 이는 `pipeline-fix-review.md`의 CRITICAL-1, CRITICAL-2를 해결한다.

#### 6.3.2 OTLP JSON 파싱 로직: 부분적으로 적절, 검증 필요

`parse_otlp_log()` 함수는 다음 구조를 파싱한다:

```python
body = data.get('Body') or data.get('body') or data
attributes = data.get('Attributes') or data.get('attributes') or {}
resource_attrs = (
    data.get('Resource', {}).get('Attributes')
    or data.get('resource', {}).get('attributes')
    or {}
)
```

**검증 포인트:**

`awscloudwatchlogs` exporter가 CW Logs에 기록하는 실제 형식은 ADOT 버전과 설정에 따라 다를 수 있다. 두 가지 가능한 형식:

1. **OTLP Export 형식**: `resourceLogs[].scopeLogs[].logRecords[]` 중첩 구조 -- 이 경우 현재 파싱 로직이 최상위 레벨에서 `Body`, `Attributes` 를 찾으므로, `logRecords[]` 내부 레코드를 개별적으로 처리해야 한다.

2. **개별 로그 레코드 형식**: 각 CW Logs 이벤트가 하나의 로그 레코드(`{ "Body": ..., "Attributes": ..., "Resource": ... }`)에 대응 -- 이 경우 현재 파싱 로직이 정상 동작한다.

ADOT `awscloudwatchlogs` exporter의 소스 코드를 확인하면, 각 OTLP 로그 레코드를 **개별 CW Logs 이벤트**로 기록한다. 즉, `logEvents[]`의 각 `message`는 개별 로그 레코드의 JSON 표현이다. 따라서 현재 파싱 로직의 접근 방식은 올바르다.

**그러나 정확한 JSON 필드명은 실제 ADOT 출력을 확인해야 한다.** `awscloudwatchlogs` exporter는 `plog.LogRecord`를 JSON으로 마샬링하며, 필드명이 대문자(`Body`, `Attributes`)인지 소문자(`body`, `attributes`)인지는 마샬러 구현에 따라 다르다. 현재 코드는 양쪽 모두를 `or`로 처리하고 있으므로 이 부분은 안전하다.

#### 6.3.3 Firehose DataFormatConversion과의 호환성: 적절

Lambda transformer가 출력하는 평면 JSON(`{"event_name": "...", "session_id": "...", ...}`)은 Firehose의 `DataFormatConversionConfiguration`에서 `OpenXJsonSerDe`로 파싱되어 Glue 스키마 기반으로 Parquet로 변환된다. 필드명이 Glue 테이블의 컬럼명과 일치하므로 정상 동작이 예상된다.

#### 6.3.4 Newline-Delimited JSON 출력: 주의 필요

```python
joined = '\n'.join(json.dumps(r, default=str) for r in flat_records) + '\n'
```

하나의 CW Logs 엔벨로프에 여러 `logEvents`가 포함될 수 있고, Lambda는 이를 newline-delimited JSON으로 결합한다. Firehose의 `OpenXJsonSerDe`는 레코드 구분자로 newline을 기대하므로 이 접근은 올바르다.

**단, Firehose의 `DataFormatConversionConfiguration`은 입력 레코드 단위로 Parquet 변환을 수행한다.** Lambda transformer가 하나의 `recordId`에 대해 여러 JSON 라인을 반환하면, Firehose가 이를 올바르게 파싱하는지 확인이 필요하다. Firehose는 newline-delimited JSON을 지원하므로 문제없을 것으로 예상되지만, **배포 후 `errors/` 경로를 반드시 모니터링해야 한다.**

### 6.4 Lambda Transformer 개선 권고사항

| 항목 | 현재 | 권고 | 우선순위 |
|------|------|------|---------|
| 에러 로깅 | `except Exception as e:` 에서 로깅 없음 | `print(f"Error processing record {record_id}: {e}")` 추가 | 높음 |
| 메트릭 | 없음 | CloudWatch 커스텀 메트릭으로 처리 건수/실패 건수 기록 | 중간 |
| OTLP 구조 검증 | `data.get('Body')` fallback 체인 | 실제 ADOT 출력으로 E2E 테스트 후 불필요한 fallback 제거 | 낮음 |

### 6.5 배포 후 검증 방법

Lambda transformer의 올바른 동작을 확인하기 위한 검증 절차:

1. **CW Logs 확인**: `/claude-code/telemetry-events` 로그 그룹에 ADOT가 기록하는 실제 JSON 형식 확인
2. **Firehose 에러 경로 확인**: S3 `errors/` 프리픽스에 레코드가 없는지 확인
3. **S3 Parquet 파일 확인**: `year=YYYY/month=MM/day=DD/hour=HH/` 경로에 Parquet 파일 생성 확인
4. **Athena 쿼리 테스트**: `SELECT * FROM claude_code_telemetry.events LIMIT 10`으로 데이터 조회 확인

---

## 7. 구현 가이드

### 7.1 변경 작업 목록

| # | 작업 | 파일 | 비고 |
|---|------|------|------|
| 1 | 디렉토리 생성 | `lib/nested-stacks/` | 새 디렉토리 |
| 2 | NetworkStack 전환 | `lib/nested-stacks/network-stack.ts` | `Stack` -> `NestedStack` |
| 3 | MetricsStack 전환 | `lib/nested-stacks/metrics-stack.ts` | `Stack` -> `NestedStack` |
| 4 | EventsStack 전환 | `lib/nested-stacks/events-stack.ts` | `Stack` -> `NestedStack` |
| 5 | CollectorStack 전환 | `lib/nested-stacks/collector-stack.ts` | `Stack` -> `NestedStack` + 최적화 |
| 6 | DashboardStack 전환 | `lib/nested-stacks/dashboard-stack.ts` | `Stack` -> `NestedStack` |
| 7 | 루트 스택 생성 | `lib/telemetry-stack.ts` | 새 파일 |
| 8 | 엔트리포인트 변경 | `bin/app.ts` | 단일 스택 인스턴스화 |
| 9 | 기존 파일 삭제 | `lib/stacks/` | 전체 디렉토리 삭제 |

### 7.2 각 Nested Stack 변경 상세

모든 Nested Stack에 공통으로 적용되는 변경 패턴:

```typescript
// 변경 전
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface XxxStackProps extends cdk.StackProps {
  readonly config: AppConfig;
}

export class XxxStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: XxxStackProps) {
    super(scope, id, props);
    // ...
  }
}

// 변경 후
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface XxxNestedStackProps extends cdk.NestedStackProps {
  readonly config: AppConfig;
}

export class XxxNestedStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: XxxNestedStackProps) {
    super(scope, id, props);
    // ... (내부 로직은 동일)
  }
}
```

### 7.3 CollectorStack 추가 최적화

CollectorNestedStack에 5.3절의 최적화를 모두 반영:

1. NLB TG 헬스체크: `healthyThresholdCount: 2`, `interval: 10초`
2. ECS 컨테이너 헬스체크: `interval: 15초`, `retries: 2`, `startPeriod: 15초`
3. Target Group `deregistrationDelay: 30초`
4. ECS Service `circuitBreaker: { rollback: true }`

### 7.4 빌드 및 검증

```bash
# 1. TypeScript 컴파일
npm run build

# 2. CDK Synth (CloudFormation 템플릿 생성)
npx cdk synth

# 3. 생성된 Nested Stack 템플릿 확인
ls cdk.out/*.nested.template.json

# 4. 배포 (단일 명령)
npx cdk deploy TelemetryStack
```

---

## 8. 마이그레이션 전략

### 8.1 전제: 기존 스택 삭제 완료

기존 5개 스택이 모두 삭제된 상태이므로, **마이그레이션이 아닌 신규 배포**로 진행한다.

### 8.2 배포 순서

1. `npx cdk synth` -- CloudFormation 템플릿 생성 및 검증
2. `npx cdk deploy TelemetryStack` -- 단일 명령으로 전체 인프라 배포

CloudFormation은 Nested Stack 간 의존성을 자동으로 해석하여 다음 순서로 생성한다:

```
[병렬] NetworkNestedStack + MetricsNestedStack + EventsNestedStack
    |
    v (위 3개 완료 후)
[병렬] CollectorNestedStack + DashboardNestedStack
```

### 8.3 S3 버킷 이름 충돌 방지

기존 EventsStack에서 생성한 S3 버킷이 `RETAIN` 정책으로 남아 있을 수 있다. CDK가 자동 생성하는 버킷 이름은 스택 ID와 해시를 포함하므로 (`telemetrystack-events-eventsbucket-xxxx`), 기존 버킷과 이름이 충돌할 가능성은 낮다.

명시적으로 `bucketName`을 지정하고 있지 않으므로, CDK 자동 생성 이름을 그대로 사용한다. 이것이 권장 패턴이다.

### 8.4 롤백 계획

배포 실패 시:
- CloudFormation이 루트 스택과 모든 Nested Stack을 자동으로 롤백한다
- 이전에 배포된 스택이 없으므로(신규 배포), 롤백 = 전체 리소스 삭제와 동일하다
- `RETAIN` 정책의 S3 버킷만 물리적으로 남으며, 이후 수동 삭제 또는 재배포 가능

### 8.5 배포 후 확인사항

| 확인 항목 | 방법 |
|-----------|------|
| 전체 스택 상태 | CloudFormation 콘솔에서 `TelemetryStack` 상태가 `CREATE_COMPLETE`인지 확인 |
| ADOT Collector 동작 | ECS 콘솔에서 태스크 상태 `RUNNING` + 헬스체크 `HEALTHY` 확인 |
| NLB 엔드포인트 | `grpcurl` 또는 `curl`로 NLB DNS:4317 연결 확인 |
| AMP 메트릭 수집 | Grafana에서 `claude_code_session_total` 메트릭 조회 |
| CW Logs 기록 | `/claude-code/telemetry-events` 로그 그룹에 이벤트 기록 확인 |
| Firehose 전달 | S3 `year=YYYY/month=MM/...` 경로에 Parquet 파일 생성 확인 |
| Firehose 에러 | S3 `errors/` 경로에 레코드가 없는지 확인 |
| Athena 쿼리 | `SELECT * FROM claude_code_telemetry.events LIMIT 10` 실행 |
| Grafana 접근 | Grafana 엔드포인트 URL 접속 확인 |
