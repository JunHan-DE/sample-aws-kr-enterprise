# 개발 가이드

이 문서는 Claude Code Observability Platform의 로컬 개발 환경 설정, 코드 구조, 빌드/테스트/배포 방법을 설명합니다.

---

## 목차

1. [개발 환경 설정](#1-개발-환경-설정)
2. [프로젝트 구조](#2-프로젝트-구조)
3. [설정 파일](#3-설정-파일)
4. [빌드 및 테스트](#4-빌드-및-테스트)
5. [CDK 배포](#5-cdk-배포)
6. [코드 컨벤션](#6-코드-컨벤션)
7. [주요 컴포넌트 가이드](#7-주요-컴포넌트-가이드)
8. [환경 변수](#8-환경-변수)
9. [메트릭 파이프라인 (AMP)](#9-메트릭-파이프라인-amp)

---

## 1. 개발 환경 설정

### 필수 도구

| 도구 | 최소 버전 | 설치 확인 | 설명 |
|------|----------|-----------|------|
| Node.js | >= 18 | `node --version` | 런타임 |
| npm | >= 9 | `npm --version` | 패키지 관리자 |
| AWS CDK CLI | >= 2.100 | `cdk --version` | CDK 명령줄 도구 |
| AWS CLI | >= 2.0 | `aws --version` | AWS 자원 관리 |
| TypeScript | >= 5.0 | `npx tsc --version` | 타입 시스템 |

### 초기 설정

```bash
# 1. 저장소 클론
git clone <repo-url>
cd claude-code-telemetry-aws

# 2. 의존성 설치
npm install

# 3. TypeScript 빌드 확인
npm run build

# 4. 테스트 실행
npm test
```

### AWS 자격증명 구성

```bash
# AWS CLI 자격증명 설정
aws configure
# 또는 프로파일 지정
aws configure --profile your-profile

# CDK 부트스트랩 (대상 리전에서 최초 1회)
cdk bootstrap aws://ACCOUNT_ID/us-east-1
```

---

## 2. 프로젝트 구조

```
claude-code-telemetry-aws/
├── bin/
│   └── app.ts                              # CDK 앱 진입점
├── lib/
│   ├── config/
│   │   └── app-config.ts                   # 공유 설정 (프로젝트명, 환경, 리전, 포트, 태그)
│   ├── telemetry-stack.ts                  # 루트 스택 (Nested Stack 오케스트레이션)
│   └── nested-stacks/
│       ├── network-stack.ts                # VPC, 서브넷, NAT Gateway, Security Group
│       ├── metrics-stack.ts                # Amazon Managed Prometheus (AMP) Workspace
│       ├── events-stack.ts                 # S3, Glue, Firehose, Lambda, CW Logs, Sub Filter
│       ├── collector-stack.ts              # ECS Fargate, ADOT Collector, NLB, Target Groups
│       └── dashboard-stack.ts              # Amazon Managed Grafana Workspace
├── config/
│   └── adot-collector-config.yaml          # ADOT Collector 파이프라인 설정 (YAML)
├── lambda/
│   └── firehose-transformer/
│       └── index.py                        # Firehose Lambda Transformer (Python 3.12)
├── grafana/
│   ├── dashboards/                         # Grafana 대시보드 JSON 파일 (6종, 80패널)
│   │   ├── overview.json                   # Prometheus+Athena 통합 (17패널, Overview)
│   │   ├── realtime-metrics.json           # Prometheus(AMP) 기반 (18패널, 실시간 메트릭)
│   │   ├── cost-analysis.json              # Athena 기반 (10패널, 비용 심층 분석)
│   │   ├── usage-insights.json             # Athena 기반 (10패널, 사용 패턴 분석)
│   │   ├── tool-analytics.json             # Athena 기반 (12패널, 도구 분석)
│   │   └── api-performance.json            # Athena 기반 (13패널, API 성능)
│   └── provisioning/
│       └── datasources/
│           └── datasources.yaml            # 데이터 소스 설정 참조
├── test/
│   └── app.test.ts                         # CDK 스냅샷 테스트
├── docs/                                   # 프로젝트 문서
├── package.json
├── tsconfig.json
├── jest.config.js
└── cdk.json
```

### 디렉토리 역할

| 디렉토리 | 역할 |
|----------|------|
| `bin/` | CDK 앱 진입점. `cdk.json`에서 이 파일을 참조합니다. |
| `lib/config/` | 전체 스택에서 공유하는 설정 (AppConfig 인터페이스). |
| `lib/nested-stacks/` | 각 Nested Stack 정의. 루트 스택(`telemetry-stack.ts`)에서 조합합니다. |
| `config/` | ADOT Collector YAML 설정. ECS 태스크 실행 시 컨테이너에 마운트됩니다. |
| `lambda/` | Lambda 함수. Firehose Transformer (CW Logs 디코딩/평탄화). 파티션 자동 등록 Lambda는 `events-stack.ts`에 인라인 정의. |
| `grafana/` | Grafana 대시보드 JSON 및 데이터 소스 프로비저닝 파일. |
| `test/` | CDK 스냅샷 테스트. |

---

## 3. 설정 파일

### `lib/config/app-config.ts`

모든 스택에서 공유하는 중앙 설정 파일입니다.

```typescript
export interface AppConfig {
  projectName: string;         // 리소스 명명 접두사
  environment: 'prod' | 'dev'; // 배포 환경
  region: string;              // AWS 배포 리전
  tags: Record<string, string>; // AWS 리소스 태그
  collectorPort: number;       // OTLP gRPC 포트 (기본: 4317)
  collectorHttpPort: number;   // OTLP HTTP 포트 (기본: 4318)
  certificateArn?: string;     // ACM 인증서 ARN (NLB TLS 종료용, 선택)
  adotCollectorVersion: string; // ADOT Collector 컨테이너 이미지 버전 태그
}
```

| 설정 항목 | 기본값 | 변경 시 영향 |
|----------|--------|-------------|
| `projectName` | `claude-code-telemetry` | S3 버킷명, IAM 역할명, ECS 클러스터명 등 모든 리소스 이름 변경 |
| `environment` | `prod` | 리소스 이름 접미사 변경. `dev`로 설정하면 별도 환경 가능 |
| `region` | `us-east-1` | 전체 스택 배포 리전 변경. CDK 부트스트랩 필요 |
| `collectorPort` | `4317` | NLB 리스너, Security Group 인바운드 규칙, ECS 포트 매핑 변경 |
| `collectorHttpPort` | `4318` | NLB 리스너, Security Group 인바운드 규칙, ECS 포트 매핑 변경 |
| `certificateArn` | (미설정) | 설정 시 NLB가 TLS 종료를 수행. 미설정 시 TCP 리스너 사용 |
| `adotCollectorVersion` | `v0.40.0` | ADOT Collector 컨테이너 이미지 버전 변경. ECS 태스크 재배포 트리거 |

### `config/adot-collector-config.yaml`

ADOT Collector의 수집(Receivers), 처리(Processors), 내보내기(Exporters) 파이프라인을 정의합니다.

주요 구성:
- **Receivers**: `otlp` (gRPC :4317, HTTP :4318)
- **Processors**: `memory_limiter` (OOM 방지, 512 MiB 제한), `batch/metrics` (60초/1000건), `batch/logs` (10초/500건)
- **Exporters**:
  - `prometheusremotewrite`: AMP로 메트릭 전송 (SigV4 인증, cumulative temporality 필수)
  - `awscloudwatchlogs`: CloudWatch Logs로 이벤트 전송
- **Extensions**: `sigv4auth` (AMP 인증), `health_check` (포트 13133, NLB 헬스체크용)

> **주의 (Delta Temporality 문제)**: `prometheusremotewrite` exporter는 delta temporality 메트릭을 **경고 없이 삭제**합니다. 클라이언트에서 반드시 `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative`을 사용하거나, 이 환경변수를 설정하지 않아 기본값(cumulative)이 적용되도록 해야 합니다. ADOT에는 `deltatocumulative` 프로세서가 포함되어 있지 않으므로 서버 측 변환은 불가능합니다.

### `cdk.json`

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/app.ts"
}
```

CDK CLI가 `bin/app.ts`를 `ts-node`로 직접 실행합니다. TypeScript 빌드 없이도 `cdk synth`가 가능하지만, 배포 전에는 반드시 `npm run build`를 실행하는 것을 권장합니다.

---

## 4. 빌드 및 테스트

### 빌드

```bash
# TypeScript 컴파일
npm run build

# 감시 모드 (파일 변경 시 자동 컴파일)
npm run watch
```

### 테스트

```bash
# Jest 테스트 실행
npm test
```

테스트 설정 (`jest.config.js`):
- 테스트 프레임워크: Jest
- TypeScript 변환: ts-jest
- 테스트 파일 패턴: `.test.ts`

### CloudFormation 템플릿 확인

```bash
# 템플릿 합성 (배포 없이 CloudFormation 템플릿 생성)
npx cdk synth

# 배포된 상태와 변경 사항 비교
npx cdk diff
```

---

## 5. CDK 배포

### 배포 명령어

```bash
# 전체 스택 배포 (루트 스택 1개로 5개 Nested Stack 자동 배포)
npx cdk deploy TelemetryStack
```

### 배포 순서 (자동)

CloudFormation이 Nested Stack 간 의존성을 자동으로 해석합니다.

```
Phase 1 (병렬):  NetworkNestedStack  |  MetricsNestedStack  |  EventsNestedStack
Phase 2 (의존):  CollectorNestedStack  |  DashboardNestedStack
```

- **CollectorNestedStack**은 NetworkNestedStack(VPC, SG), MetricsNestedStack(AMP URL), EventsNestedStack(CW Log Group)에 의존합니다.
- **DashboardNestedStack**은 MetricsNestedStack(AMP ARN)에 의존합니다.

### 스택 삭제

```bash
# 루트 스택 삭제 (모든 Nested Stack 역순 자동 삭제)
npx cdk destroy TelemetryStack
```

S3 버킷은 `RemovalPolicy.RETAIN` 정책으로 스택 삭제 시 보존됩니다. 완전 삭제가 필요하면 수동으로 S3 버킷을 비우고 삭제해야 합니다.

---

## 6. 코드 컨벤션

### 리소스 명명 규칙

모든 AWS 리소스 이름은 `{projectName}-{용도}-{environment}` 패턴을 따릅니다.

```
예시:
  claude-code-telemetry-collector-prod         (ECS 클러스터)
  claude-code-telemetry-collector-svc-prod     (ECS 서비스)
  claude-code-telemetry-events-stream-prod     (Firehose)
  claude-code-telemetry-grafana-prod           (Grafana)
```

### Nested Stack 구조 규칙

- 각 Nested Stack은 `cdk.NestedStack`을 상속합니다.
- Nested Stack 간 의존성은 루트 스택(`telemetry-stack.ts`)에서 `props`를 통해 주입합니다.
- Nested Stack은 다른 Nested Stack을 직접 참조하지 않습니다.

### TypeScript 스타일

- `strictNullChecks` 활성화 (`tsconfig.json`)
- CDK L2 Construct 사용을 우선합니다 (L1 CfnResource는 L2가 없는 경우에만 사용).
- `appConfig` 객체를 통해 환경별 설정을 주입합니다.

---

## 7. 주요 컴포넌트 가이드

### Lambda Transformer (`lambda/firehose-transformer/index.py`)

Firehose가 CloudWatch Logs Subscription Filter를 통해 수신한 데이터를 처리합니다.

**처리 흐름**:
1. Firehose 레코드에서 Base64 디코딩
2. CloudWatch Logs 엔벨로프 gzip 해제 및 JSON 파싱
3. 각 로그 이벤트에서 OTel 이벤트 데이터 추출
4. Glue 테이블 스키마에 맞게 필드 평탄화(flatten)
5. 처리된 레코드를 Firehose에 반환 (Parquet 변환은 Firehose가 수행)

**수정 시 주의사항**:
- Glue 테이블 스키마(`docs/data-schema.md`)와 Lambda 출력 필드가 일치해야 합니다.
- 새 필드를 추가하면 Glue 테이블, Lambda Transformer, `docs/data-schema.md`를 모두 업데이트해야 합니다.

### Partition Register Lambda (인라인 코드: `lib/nested-stacks/events-stack.ts`)

Firehose가 S3에 새 Parquet 파일을 쓸 때 자동으로 Glue 파티션을 등록합니다. 이 Lambda는 별도 파일이 아닌 `events-stack.ts` 내에 `lambda.Code.fromInline()`으로 정의되어 있습니다.

**처리 흐름**:
1. S3 `ObjectCreated` 이벤트를 EventBridge를 통해 수신
2. S3 오브젝트 키에서 `year=/month=/day=/hour=` 파티션 값 파싱
3. Glue `BatchCreatePartition` API로 파티션 직접 등록
4. 이미 존재하는 파티션은 `AlreadyExistsException` 처리로 안전하게 무시 (멱등성)

**이전 방식과의 차이**:
- 이전: EventBridge (매시간) → Lambda → Athena `MSCK REPAIR TABLE` (최대 1시간 지연, 전체 S3 스캔, Athena 비용)
- 현재: S3 ObjectCreated → EventBridge → Lambda → Glue `BatchCreatePartition` (수 초 내 반영, Athena 비용 없음)

**수정 시 주의사항**:
- Glue 데이터베이스명과 테이블명이 CDK `events-stack.ts`의 설정과 일치해야 합니다.
- S3 이벤트 필터(`prefix`, `suffix`)가 Firehose의 출력 경로와 일치해야 합니다.
- 파티션 컬럼(`year`, `month`, `day`, `hour`)의 순서가 Glue 테이블 정의와 일치해야 합니다.

### ADOT Collector 설정 (`config/adot-collector-config.yaml`)

**수정 시 주의사항**:
- YAML 구문 오류 시 ADOT 컨테이너가 시작되지 않습니다.
- 수정 후 재배포하면 ECS 태스크가 교체됩니다 (Rolling Update).
- `health_check` extension의 포트(13133)는 NLB 타겟 그룹 헬스체크와 일치해야 합니다.

### Grafana 대시보드 JSON

**수정 시 주의사항**:
- 대시보드 JSON 내 `datasource.uid` 값이 Grafana 데이터 소스 UID와 정확히 일치해야 합니다.
  - Overview 대시보드 (1종): `"uid": "prometheus"` + `"uid": "athena"` — overview.json (Prometheus+Athena 통합)
  - Prometheus 대시보드 (1종): `"uid": "prometheus"` — realtime-metrics.json
  - Athena 대시보드 (4종): `"uid": "athena"` — cost-analysis.json, usage-insights.json, tool-analytics.json, api-performance.json
- 대시보드 설계는 `docs/dashboard-design.md`를 참조합니다.

---

## 8. 환경 변수

### CDK 배포 관련

| 변수 | 설명 | 예시 |
|------|------|------|
| `AWS_PROFILE` | AWS CLI 프로파일 지정 | `aws-dev` |
| `AWS_REGION` | AWS 리전 (CDK에서는 `app-config.ts`가 우선) | `us-east-1` |
| `CDK_DEFAULT_ACCOUNT` | CDK 기본 AWS 계정 ID | `123456789012` |
| `CDK_DEFAULT_REGION` | CDK 기본 리전 | `us-east-1` |

### Claude Code 개발자 환경 변수

개발자가 Claude Code에서 텔레메트리를 전송하기 위한 환경변수입니다. 상세 설정은 [claude-code-setup-guide.md](claude-code-setup-guide.md)를 참조하세요.

| 변수 | 설명 | 필수 |
|------|------|------|
| `CLAUDE_CODE_ENABLE_TELEMETRY` | 텔레메트리 활성화 (`1`) | 필수 |
| `OTEL_METRICS_EXPORTER` | 메트릭 내보내기 유형 (`otlp`) | 메트릭 수집 시 필수 |
| `OTEL_LOGS_EXPORTER` | 로그 내보내기 유형 (`otlp`) | 이벤트 수집 시 필수 |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | OTLP 프로토콜 (`grpc`) | 필수 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP 엔드포인트 | 필수 |
| `OTEL_RESOURCE_ATTRIBUTES` | 팀/부서 식별 속성 | 선택 |

---

## 9. 메트릭 파이프라인 (AMP)

이 섹션은 ADOT Collector를 통해 AMP(Amazon Managed Prometheus)로 전송되는 메트릭 파이프라인의 구성과 주의사항을 설명합니다.

### 파이프라인 구조

```
Claude Code (OTel SDK, cumulative temporality)
    | OTLP Metrics
    v
NLB (:4317 gRPC / :4318 HTTP)
    |
    v
ADOT Collector
    | otlp receiver → memory_limiter → batch/metrics (60s, 1000건)
    | → prometheusremotewrite exporter (SigV4 인증)
    v
AMP (Amazon Managed Prometheus)
    | PromQL 쿼리
    v
Grafana (Real-Time Metrics 대시보드)
```

### AMP에 저장되는 8개 Prometheus 메트릭

| 메트릭 이름 | 설명 | 주요 레이블 |
|-------------|------|-------------|
| `claude_code_session_count` | 세션 시작 횟수 | organization_id, user_id, session_id |
| `claude_code_lines_of_code_count` | 코드 변경 라인 수 | organization_id, user_id, type (added/removed) |
| `claude_code_pull_request_count` | PR 생성 수 | organization_id, user_id |
| `claude_code_commit_count` | 커밋 수 | organization_id, user_id |
| `claude_code_cost_usage` | 비용 (USD) | organization_id, user_id, model |
| `claude_code_token_usage` | 토큰 사용량 | organization_id, user_id, model, type |
| `claude_code_code_edit_tool_decision` | 코드 편집 도구 결정 | organization_id, user_id, tool_name, decision, source |
| `claude_code_active_time_total` | 활성 시간 (초) | organization_id, user_id, type |

### ADOT 설정 상세 (`config/adot-collector-config.yaml`)

메트릭 파이프라인의 주요 설정:

```yaml
processors:
  memory_limiter:
    check_interval: 1s
    limit_mib: 512          # OOM 방지
    spike_limit_mib: 128
  batch/metrics:
    timeout: 60s
    send_batch_size: 1000
    send_batch_max_size: 1500

exporters:
  prometheusremotewrite:
    endpoint: ${AMP_REMOTE_WRITE_ENDPOINT}
    auth:
      authenticator: sigv4auth
    resource_to_telemetry_conversion:
      enabled: true          # OTel 리소스 속성을 Prometheus 레이블로 변환
```

### Delta Temporality 문제 (중요)

`prometheusremotewrite` exporter는 **cumulative temporality만 지원**합니다. Delta temporality 메트릭(monotonic counter, histogram, summary)은 **경고나 에러 로그 없이 삭제**됩니다.

**클라이언트 요구사항**:
- `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative` 설정 (또는 미설정으로 기본값 사용)
- `delta` 설정 시 메트릭이 AMP에 전혀 도달하지 않음

**ADOT 제약사항**:
- `deltatocumulative` 프로세서는 ADOT 어떤 버전에도 포함되어 있지 않음
- 서버 측에서 delta → cumulative 변환이 불가능하므로 클라이언트 측 설정이 필수

**검증 방법**:
```bash
# AMP에서 메트릭 존재 확인 (awscurl 사용)
awscurl --service aps --region us-east-1 \
  "https://aps-workspaces.us-east-1.amazonaws.com/workspaces/{workspace_id}/api/v1/query?query=claude_code_session_count"
```

### 이벤트 파이프라인과의 관계

메트릭 파이프라인과 이벤트 파이프라인은 독립적으로 동작합니다:

| 항목 | 메트릭 파이프라인 | 이벤트 파이프라인 |
|------|-------------------|-------------------|
| 데이터 유형 | OTel Metrics (카운터) | OTel Logs/Events |
| 저장소 | AMP (Prometheus) | S3 (Parquet) → Athena |
| 쿼리 언어 | PromQL | SQL |
| 대시보드 | Overview (11패널) + Real-Time Metrics (18패널) | Overview (6패널) + Athena 대시보드 4종 (45패널) |
| 갱신 주기 | 30초 (실시간) | 5~10분 (Firehose 버퍼링) |
| 용도 | 실시간 운영 모니터링 | 상세 이벤트 분석, 비용 분석 |

---

## 참고 문서

- [아키텍처](architecture.md) - 상세 시스템 아키텍처
- [배포 가이드](deployment-guide.md) - 단계별 배포 절차
- [데이터 스키마](data-schema.md) - S3/Glue/Athena 스키마 및 쿼리 예시
- [Claude Code 설정](claude-code-setup-guide.md) - 개발자 환경 구성
- [대시보드 설계](dashboard-design.md) - Grafana 대시보드 레이아웃 및 쿼리
- [대시보드 가이드](dashboard-guide.md) - 대시보드 사용 가이드 (6종 80패널: Overview 1종 + Prometheus 1종 + Athena 4종)
- [비용 예상](cost-estimation.md) - 팀 규모별 비용 분석
