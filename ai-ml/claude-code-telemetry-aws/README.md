# Claude Code Observability Platform on AWS

Claude Code의 OpenTelemetry 텔레메트리 데이터를 수집, 저장, 분석하기 위한 AWS 관측성(Observability) 플랫폼입니다. AWS CDK(TypeScript)로 전체 인프라를 정의하며, **이중 파이프라인**으로 운영됩니다: 메트릭은 Amazon Managed Prometheus(AMP)에 저장하여 실시간 모니터링(30초 갱신)을, 이벤트는 S3(Parquet) + Athena에 저장하여 심층 분석을 제공합니다. Amazon Managed Grafana에서 6개 프로덕션 수준 대시보드(80패널)로 통합 시각화합니다. 게이지 패널, 스파크라인, 그라디언트 채움, 임계값 기반 색상, 테이블 셀 컬러링, 드릴다운 데이터 링크 등 운영 환경에 적합한 시각화를 제공합니다. 설계 철학: Prometheus는 실시간 집계 메트릭, Athena는 이벤트 레벨 심층 분석에 특화하며, 두 데이터 소스 간 중복이 없습니다.

---

## 아키텍처

```
Developer PCs (Claude Code + OTel SDK)
    |
    | OTLP gRPC (:4317) / HTTP (:4318)
    v
NLB (Network Load Balancer, Internet-facing)
    |
    v
ADOT Collector (ECS Fargate, Private Subnet)
    |
    +-- Metrics Pipeline --> Prometheus Remote Write --> AMP
    |
    +-- Logs Pipeline ----> CloudWatch Logs --> Kinesis Data Firehose
                                                    |
                                                    v (Lambda 변환)
                                               S3 (Parquet, Snappy)
                                                    |
                                          +---------+---------+
                                          |                   |
                                          v                   v
                                   S3 Event →          Glue Catalog
                                   EventBridge →         + Athena
                                   Lambda →                  |
                                   Glue BatchCreate          v
                                   Partition          Amazon Managed Grafana
                                   (실시간 파티션 등록)  (6개 대시보드, 80패널)
```

## 주요 기능

이 플랫폼은 6개의 Grafana 대시보드, 총 80개 패널을 통해 Claude Code 사용 현황을 전방위로 모니터링합니다. 게이지 패널, 스파크라인, 그라디언트 채움, 임계값 기반 색상, 테이블 셀 컬러링, 드릴다운 데이터 링크 등 프로덕션 수준의 시각화를 제공합니다. Prometheus는 실시간 집계 메트릭(카운터/비율)에, Athena는 이벤트 레벨 심층 분석에 특화하여 중복 없이 역할을 분리합니다.

### 실시간 메트릭 대시보드 (Prometheus/AMP)

| 대시보드 | 패널 | 설명 | 데이터 소스 |
|----------|------|------|-------------|
| **Overview** | 17 | Prometheus + Athena 통합 요약. 핵심 KPI(세션/비용/토큰/활성시간/커밋/PR), 스파크라인, 임계값 색상, 비용 추이, 레이턴시, 이벤트 분포, 도구 사용, 최근 세션 | Prometheus (AMP) + Athena |
| **Real-Time Metrics** | 18 | 8종 Prometheus 메트릭 실시간 모니터링. 게이지(캐시 히트율/수락률), 스파크라인, 그라디언트 채움, 드릴다운 링크. 30초 자동 새로고침 | Prometheus (AMP) |

### 이벤트 심층 분석 대시보드 (Athena)

| 대시보드 | 패널 | 설명 | 데이터 소스 |
|----------|------|------|-------------|
| **Cost Deep Analysis** | 10 | 요청 단위 비용 분석, 모델별 비용 심층 비교, 임계값 색상, 테이블 셀 컬러링, 캐시 절감, 프롬프트당 비용 | Athena |
| **Usage & Session Insights** | 10 | 세션 흐름, 프롬프트 복잡도, 모델 역할 패턴, 테이블 셀 컬러링, 버전 분포 | Athena |
| **Tool Analytics** | 12 | 게이지(성공률/수락률), 그라디언트 바 차트, 테이블 셀 컬러링, 성공률 추이, 에러 패턴 | Athena |
| **API Performance** | 13 | 게이지(에러율), 그라디언트 채움, 임계값 라인, 테이블 셀 컬러링, 레이턴시-처리량 상관관계 | Athena |

주요 분석 기능:
- **실시간 메트릭 모니터링**: AMP 기반 8종 Prometheus 카운터 메트릭을 PromQL로 실시간 조회 (30초 갱신)
- **OTel 기반 관측가능성**: Claude Code의 5가지 이벤트 타입(api_request, api_error, tool_result, tool_decision, user_prompt) 수집 및 분석
- **비용 심층 분석**: 요청 단위 비용 분포, 모델별 비용 효율 비교, 캐시 절감 효과, 프롬프트당 비용
- **세션 인사이트**: 세션 복잡도, 모델 역할 패턴(라우터 vs 생성자), 프롬프트 길이 분포
- **도구 분석**: 도구별 성공률/실행 시간, 자동/수동 승인 비율, 결과 크기 모니터링
- **성능 모니터링**: API 레이턴시 백분위수, 속도 모드별 성능, 캐시가 성능에 미치는 영향

> 대시보드 상세 가이드는 [docs/dashboard-guide.md](docs/dashboard-guide.md)를 참조하세요.

## CDK 스택 구성

| 스택 | 설명 | 주요 리소스 |
|------|------|-------------|
| **NetworkStack** | VPC, 서브넷 (2 AZ), 보안 그룹 | VPC, NAT GW, Security Group |
| **MetricsStack** | Prometheus 워크스페이스 | AMP Workspace |
| **EventsStack** | 이벤트 파이프라인 | S3, Firehose, Glue DB/Table, 파티션 자동 등록 Lambda |
| **CollectorStack** | 텔레메트리 수집기 | ECS Fargate, ADOT Container, NLB |
| **DashboardStack** | 시각화 | Amazon Managed Grafana Workspace |

## 사전 요구사항

- **Node.js** >= 18
- **AWS CDK CLI**: `npm install -g aws-cdk`
- **AWS CLI**: 자격증명 구성 완료 (`aws configure`)
- **AWS 계정**: CDK 부트스트랩 완료 (`cdk bootstrap`)
- **AWS IAM Identity Center (SSO)**: Grafana 인증에 필요

## 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 설정 커스터마이즈 (리전, 환경, 태그 등)
#    lib/config/app-config.ts 편집

# 3. 빌드
npm run build

# 4. CloudFormation 템플릿 합성 (선택)
npx cdk synth

# 5. 전체 스택 배포 (루트 스택 1개로 5개 Nested Stack 자동 배포)
npx cdk deploy TelemetryStack

# 6. Claude Code 환경변수 설정 (개발자 PC)
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://<NLB_DNS>:4317
# 메트릭 temporality: cumulative 필수 (delta 사용 시 AMP에 메트릭 미수신)
export OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative
```

> 상세 배포 가이드는 [docs/deployment-guide.md](docs/deployment-guide.md)를 참조하세요.
> Claude Code 개발자 설정은 [docs/claude-code-setup-guide.md](docs/claude-code-setup-guide.md)를 참조하세요.

## 설정 (Configuration)

`lib/config/app-config.ts`를 편집하여 커스터마이즈합니다.

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `projectName` | `claude-code-telemetry` | 리소스 명명 접두사 |
| `environment` | `prod` | 환경 (`prod` / `dev`) |
| `region` | `us-east-1` | AWS 배포 리전 |
| `collectorPort` | `4317` | OTLP gRPC 포트 |
| `collectorHttpPort` | `4318` | OTLP HTTP 포트 |

## 프로젝트 구조

```
claude-code-telemetry-aws/
├── bin/
│   └── app.ts                          # CDK 앱 진입점
├── lib/
│   ├── config/
│   │   └── app-config.ts               # 공유 설정 (리전, 포트, 태그)
│   ├── telemetry-stack.ts              # 루트 스택 (Nested Stack 오케스트레이션)
│   └── nested-stacks/
│       ├── network-stack.ts            # VPC, 서브넷, NAT GW, 보안 그룹
│       ├── metrics-stack.ts            # AMP 워크스페이스
│       ├── events-stack.ts             # S3, Firehose, Glue, Lambda, CW Logs
│       ├── collector-stack.ts          # ECS Fargate, ADOT, NLB
│       └── dashboard-stack.ts          # Managed Grafana
├── config/
│   └── adot-collector-config.yaml      # ADOT Collector 파이프라인 설정
├── lambda/
│   └── firehose-transformer/
│       └── index.py                    # Firehose Lambda Transformer (Python 3.12)
├── grafana/
│   ├── dashboards/                     # Grafana 대시보드 JSON (6종, 80패널)
│   │   ├── overview.json               # Prometheus+Athena - Overview (17패널)
│   │   ├── realtime-metrics.json       # Prometheus(AMP) - Real-Time Metrics (18패널)
│   │   ├── cost-analysis.json          # Athena - Cost Deep Analysis (10패널)
│   │   ├── usage-insights.json         # Athena - Usage & Session Insights (10패널)
│   │   ├── tool-analytics.json         # Athena - Tool Analytics (12패널)
│   │   └── api-performance.json        # Athena - API Performance (13패널)
│   └── provisioning/                   # 데이터 소스 설정
│       └── datasources/
│           └── datasources.yaml
├── docs/
│   ├── dashboard-guide.md              # 대시보드 사용 가이드 (6종 80패널, FAQ, 트러블슈팅)
│   ├── dashboard-requirements.md       # 데이터 기반 시각화 요구사항 정의
│   ├── data-analysis.md                # 34개 컬럼 전수 분석, cross-event 조인 메트릭
│   ├── architecture.md                 # 상세 아키텍처 문서
│   ├── deployment-guide.md             # 배포 가이드
│   ├── deployment-result.md            # 배포 결과 및 검증
│   ├── development.md                  # 개발 가이드
│   ├── progress.md                     # 프로젝트 진행 상황
│   ├── cost-estimation.md              # 비용 예상
│   ├── otel-schema.md                  # OTel 메트릭/이벤트 스키마
│   ├── data-schema.md                  # S3/Glue/Athena 데이터 스키마
│   ├── dashboard-design.md             # 대시보드 UX 설계
│   ├── claude-code-setup-guide.md      # 개발자 설정 가이드
│   ├── nested-stack-design.md          # Nested Stack 설계 문서
│   └── code-review-*.md               # 코드 리뷰 보고서
├── test/
│   └── app.test.ts                     # CDK 스냅샷 테스트
├── package.json
├── tsconfig.json
└── cdk.json
```

## 비용 예상

월간 예상 비용 (서울 리전 기준):

| 팀 규모 | 예상 월 비용 (USD) |
|----------|-------------------|
| 10명 | $170 ~ $250 |
| 50명 | $350 ~ $550 |
| 200명 | $900 ~ $1,500 |

> 상세 비용 분석은 [docs/cost-estimation.md](docs/cost-estimation.md)를 참조하세요.

## 유용한 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run build` | TypeScript 컴파일 |
| `npm run watch` | 감시 모드 컴파일 |
| `npm test` | Jest 테스트 실행 |
| `npx cdk synth` | CloudFormation 합성 |
| `npx cdk diff` | 배포 상태와 비교 |
| `npx cdk deploy TelemetryStack` | 전체 스택 배포 |
| `npx cdk destroy TelemetryStack` | 전체 스택 삭제 |

## 문서

- [프로젝트 진행 상황](docs/progress.md) - 현재 상태, 완료/진행 중 작업, 다음 할 일
- [대시보드 가이드](docs/dashboard-guide.md) - 6종 80패널 대시보드 상세 사용 가이드, FAQ, 트러블슈팅
- [대시보드 요구사항](docs/dashboard-requirements.md) - 데이터 기반 인사이트, KPI 정의, 시각화 요구사항
- [데이터 분석](docs/data-analysis.md) - 34개 컬럼 전수 분석, 미사용 필드, cross-event 조인 메트릭
- [개발 가이드](docs/development.md) - 개발 환경 설정, 코드 구조, 빌드/배포
- [아키텍처](docs/architecture.md) - 상세 시스템 아키텍처
- [배포 가이드](docs/deployment-guide.md) - 단계별 배포 절차
- [배포 결과](docs/deployment-result.md) - 배포 검증 결과 및 출력값
- [비용 예상](docs/cost-estimation.md) - 팀 규모별 비용 분석
- [OTel 스키마](docs/otel-schema.md) - 메트릭/이벤트 스키마
- [데이터 스키마](docs/data-schema.md) - S3 파티셔닝 및 Glue 카탈로그
- [대시보드 설계](docs/dashboard-design.md) - Grafana 대시보드 레이아웃
- [Claude Code 설정](docs/claude-code-setup-guide.md) - 개발자 환경 구성

## 라이선스

MIT License

---

# Claude Code Observability Platform on AWS (English)

An AWS observability platform for collecting, storing, and analyzing OpenTelemetry telemetry data from Claude Code. The entire infrastructure is defined using AWS CDK (TypeScript). It operates a **dual pipeline**: metrics are stored in Amazon Managed Prometheus (AMP) for real-time monitoring (30s refresh), while events are stored in S3 (Parquet) + Athena for detailed analysis. Unified visualization through Amazon Managed Grafana with 6 production-ready dashboards (80 panels) featuring gauge panels, sparklines, gradient fills, threshold-based coloring, table cell coloring, and drill-down data links. Design philosophy: Prometheus for real-time aggregated metrics, Athena for event-level deep analysis, with no duplication between the two.

## Architecture

```
Developer PCs (Claude Code + OTel SDK)
    |
    | OTLP gRPC (:4317) / HTTP (:4318)
    v
NLB (Network Load Balancer, Internet-facing)
    |
    v
ADOT Collector (ECS Fargate, Private Subnet)
    |
    +-- Metrics Pipeline --> Prometheus Remote Write --> AMP
    |
    +-- Logs Pipeline ----> CloudWatch Logs --> Kinesis Data Firehose
                                                    |
                                                    v (Lambda Transform)
                                               S3 (Parquet, Snappy)
                                                    |
                                          +---------+---------+
                                          |                   |
                                          v                   v
                                   S3 Event →          Glue Catalog
                                   EventBridge →         + Athena
                                   Lambda →                  |
                                   Glue BatchCreate          v
                                   Partition          Amazon Managed Grafana
                                   (real-time          (6 dashboards, 80 panels)
                                    partition reg.)
```

## Key Features

The platform provides comprehensive Claude Code monitoring through 6 production-ready Grafana dashboards with 80 total panels (verified by JSON audit), featuring gauge panels, sparklines, gradient fills, threshold-based coloring, table cell coloring, and drill-down data links. Design philosophy: Prometheus for real-time aggregated metrics (counters/rates), Athena for event-level deep analysis, with no duplication between the two.

### Real-Time Metrics Dashboard (Prometheus/AMP)

| Dashboard | Panels | Description | Data Source |
|-----------|--------|-------------|-------------|
| **Overview** | 17 | Prometheus + Athena integrated summary. Key KPIs (sessions/cost/tokens/active time/commits/PRs) with sparklines, threshold coloring, cost trends, latency, event distribution, tool usage, recent sessions | Prometheus (AMP) + Athena |
| **Real-Time Metrics** | 18 | 8 Prometheus counter metrics with gauges (cache hit ratio/acceptance rate), sparklines, gradient fills, drill-down links. 30s auto-refresh | Prometheus (AMP) |

### Event Deep Analysis Dashboards (Athena)

| Dashboard | Panels | Description | Data Source |
|-----------|--------|-------------|-------------|
| **Cost Deep Analysis** | 10 | Per-request cost analysis, model cost efficiency, threshold coloring, table cell coloring, cache savings, cost per prompt | Athena |
| **Usage & Session Insights** | 10 | Session flow, prompt complexity, model role patterns, table cell coloring, version distribution | Athena |
| **Tool Analytics** | 12 | Gauges (success/accept rate), gradient bar charts, table cell coloring, success rate trend, error patterns | Athena |
| **API Performance** | 13 | Gauge (error rate), gradient fills, threshold lines, table cell coloring, latency-throughput correlation | Athena |

Key analysis capabilities:
- **Real-Time Metrics Monitoring**: 8 Prometheus counter metrics via AMP with PromQL queries (30s refresh)
- **OTel-based Observability**: Collects and analyzes 5 event types (api_request, api_error, tool_result, tool_decision, user_prompt)
- **Cost Deep Analysis**: Per-request cost distribution, model cost efficiency, cache savings, per-prompt cost via cross-event joins
- **Session Insights**: Session complexity, model role patterns (router vs generator), prompt length distribution
- **Tool Analytics**: Per-tool success rate/execution time, auto/manual approval ratios, result size monitoring
- **Performance Monitoring**: API latency percentiles, speed mode performance, cache impact on latency

> For detailed dashboard guide, see [docs/dashboard-guide.md](docs/dashboard-guide.md).

## CDK Stacks

| Stack | Description | Key Resources |
|-------|-------------|---------------|
| **NetworkStack** | VPC, subnets (2 AZs), security groups | VPC, NAT GW, Security Group |
| **MetricsStack** | Prometheus workspace | AMP Workspace |
| **EventsStack** | Event pipeline | S3, Firehose, Glue DB/Table, Partition Register Lambda |
| **CollectorStack** | Telemetry collector | ECS Fargate, ADOT Container, NLB |
| **DashboardStack** | Visualization | Amazon Managed Grafana Workspace |

## Prerequisites

- **Node.js** >= 18
- **AWS CDK CLI**: `npm install -g aws-cdk`
- **AWS CLI**: Configured with credentials (`aws configure`)
- **AWS Account**: CDK bootstrapped (`cdk bootstrap`)
- **AWS IAM Identity Center (SSO)**: Required for Grafana authentication

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Customize settings (region, environment, tags)
#    Edit lib/config/app-config.ts

# 3. Build
npm run build

# 4. Synthesize CloudFormation templates (optional)
npx cdk synth

# 5. Deploy all stacks (single root stack deploys 5 nested stacks)
npx cdk deploy TelemetryStack

# 6. Configure Claude Code environment variables (developer PC)
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://<NLB_DNS>:4317
# Metrics temporality: cumulative required (delta metrics are silently dropped by AMP)
export OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative
```

> For detailed deployment instructions, see [docs/deployment-guide.md](docs/deployment-guide.md).
> For Claude Code developer setup, see [docs/claude-code-setup-guide.md](docs/claude-code-setup-guide.md).

## Estimated Costs

Monthly estimated costs (Seoul region):

| Team Size | Estimated Monthly Cost (USD) |
|-----------|------------------------------|
| 10 developers | $170 ~ $250 |
| 50 developers | $350 ~ $550 |
| 200 developers | $900 ~ $1,500 |

> For detailed cost analysis, see [docs/cost-estimation.md](docs/cost-estimation.md).

## Documentation

- [Progress](docs/progress.md) - Current status, completed/in-progress work, next steps
- [Dashboard Guide](docs/dashboard-guide.md) - Detailed guide for 6 dashboards (80 panels), FAQ, troubleshooting
- [Dashboard Requirements](docs/dashboard-requirements.md) - Data-driven insights, KPI definitions, visualization requirements
- [Data Analysis](docs/data-analysis.md) - Full 34-column analysis, unused fields, cross-event join metrics
- [Development Guide](docs/development.md) - Dev environment, code structure, build/deploy
- [Architecture](docs/architecture.md) - Detailed system architecture
- [Deployment Guide](docs/deployment-guide.md) - Step-by-step deployment
- [Deployment Result](docs/deployment-result.md) - Deployment verification and outputs
- [Cost Estimation](docs/cost-estimation.md) - Cost analysis by team size
- [OTel Schema](docs/otel-schema.md) - Metrics and events schema
- [Data Schema](docs/data-schema.md) - S3 partitioning and Glue catalog
- [Dashboard Design](docs/dashboard-design.md) - Grafana dashboard layouts
- [Claude Code Setup](docs/claude-code-setup-guide.md) - Client configuration

## License

MIT License
