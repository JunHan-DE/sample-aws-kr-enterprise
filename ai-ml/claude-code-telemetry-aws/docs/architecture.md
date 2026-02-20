# 아키텍처 문서

이 문서는 Claude Code Observability Platform의 상세 아키텍처를 설명합니다.

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [전체 아키텍처](#2-전체-아키텍처)
3. [컴포넌트별 역할](#3-컴포넌트별-역할)
4. [데이터 흐름](#4-데이터-흐름)
5. [스택 구조 및 의존성](#5-스택-구조-및-의존성)
6. [보안 아키텍처](#6-보안-아키텍처)
7. [확장성 고려사항](#7-확장성-고려사항)

---

## 1. 시스템 개요

Claude Code Observability Platform은 개발자가 사용하는 Claude Code의 OpenTelemetry(OTel) 텔레메트리 데이터를 수집하여 AWS 관리형 서비스 기반으로 메트릭 분석과 이벤트 분석을 수행하는 관측성 플랫폼입니다.

### 핵심 설계 원칙

- **관리형 서비스 우선**: 운영 부담을 최소화하기 위해 ECS Fargate, AMP, Managed Grafana 등 서버리스/관리형 서비스 활용
- **이중 파이프라인**: 메트릭(시계열)과 이벤트(로그)를 각각 최적화된 스토리지로 분리 저장
- **비용 효율**: S3 수명주기 정책, 이벤트 기반 파티션 등록, Parquet 압축 등을 통한 비용 최적화
- **인프라 as 코드**: 전체 인프라를 AWS CDK(TypeScript)로 정의하여 재현 가능한 배포
- **단일 스택 배포**: 1개 루트 스택(TelemetryStack) + 5개 NestedStack 구조로 원자적 배포/롤백 보장

### 이중 파이프라인

이 플랫폼은 메트릭과 이벤트를 각각 최적화된 경로로 처리하는 **이중 파이프라인**을 운영합니다. 두 파이프라인 모두 정상 가동 중입니다.

| 파이프라인 | 데이터 | 저장소 | 대시보드 | 갱신 주기 |
|------------|--------|--------|----------|-----------|
| **메트릭** | 세션 수, 토큰 사용량, 비용, 코드 라인, 커밋, PR, 활성 시간, 도구 결정 (8종 카운터) | AMP (Prometheus) | Overview (11패널) + Real-Time Metrics (18패널) | 30초 (실시간) |
| **이벤트** | 사용자 프롬프트, 도구 실행 결과, API 요청/응답, API 오류, 도구 결정 (5종 이벤트) | S3 (Parquet) → Athena | Overview (6패널) + Athena 대시보드 4종 (45패널) | 5~10분 (배치) |

---

## 2. 전체 아키텍처

```
                              +-----------------------+
                              |   Developer PCs       |
                              |   (Claude Code +      |
                              |    OTel SDK)           |
                              +-----------+-----------+
                                          |
                              OTLP gRPC (:4317)
                              OTLP HTTP (:4318)
                                          |
                              +-----------v-----------+
                              |   Network Load        |
                              |   Balancer (NLB)      |
                              |   (Internet-facing,   |
                              |    Public Subnets)     |
                              +-----------+-----------+
                                          |
                       +------------------+------------------+
                       |         VPC (2 AZs)                 |
                       |  +-------------------------------+  |
                       |  |      Private Subnets           |  |
                       |  |                                |  |
                       |  |  +-------------------------+   |  |
                       |  |  | ECS Fargate Cluster     |   |  |
                       |  |  | (ADOT Collector)        |   |  |
                       |  |  | 0.5 vCPU / 1 GB         |   |  |
                       |  |  | Auto-scaling 1~5 tasks  |   |  |
                       |  |  +------+----------+------+   |  |
                       |  |         |          |           |  |
                       |  +---------|----------|----------+  |
                       +------------|----------|-------------+
                                    |          |
                    +---------------+          +----------------+
                    |                                           |
          +---------v----------+                    +-----------v-----------+
          | Metrics Pipeline   |                    | Logs/Events Pipeline  |
          |                    |                    |                       |
          | Prometheus Remote  |                    | CloudWatch Logs       |
          | Write (SigV4)      |                    | (awscloudwatchlogs)   |
          +---------+----------+                    +-----------+-----------+
                    |                                           |
          +---------v----------+                    +-----------v-----------+
          | Amazon Managed     |                    | Subscription Filter   |
          | Prometheus (AMP)   |                    +-----------+-----------+
          |                    |                                |
          +---------+----------+                    +-----------v-----------+
                    |                               | Kinesis Data Firehose |
                    |                               | + Lambda Transformer  |
                    |                               +-----------+-----------+
                    |                                           |
                    |                               +-----------v-----------+
                    |                               | Amazon S3             |
                    |                               | (Parquet, Snappy)     |
                    |                               | Hive Partitioning     |
                    |                               +-----------+-----------+
                    |                                           |
                    |                               +-----------v-----------+
                    |                               | AWS Glue Data Catalog |
                    |                               | (Event-driven         |
                    |                               |  Partition Register)   |
                    |                               +-----------+-----------+
                    |                                           |
                    |                               +-----------v-----------+
                    |                               | Amazon Athena         |
                    |                               | (SQL 쿼리)            |
                    |                               +-----------+-----------+
                    |                                           |
          +---------v-------------------------------------------v-----------+
          |           Amazon Managed Grafana (6 dashboards, 80 panels)      |
          |                                                                |
          |  Overview (Prometheus + Athena):                               |
          |  +-----------------+                                           |
          |  | Overview        |  17 panels, KPI summary, entry point     |
          |  +-----------------+                                           |
          |                                                                |
          |  Prometheus (AMP):                                             |
          |  +-----------------+                                           |
          |  | Real-Time       |  18 panels, 30s refresh, PromQL           |
          |  | Metrics         |                                           |
          |  +-----------------+                                           |
          |                                                                |
          |  Athena (SQL):                                                 |
          |  +------+ +-------+ +------+ +---------+                      |
          |  | Cost | | Usage | | Tool | |   API   |                      |
          |  +------+ +-------+ +------+ +---------+                      |
          +----------------------------------------------------------------+
```

---

## 3. 컴포넌트별 역할

### 3.1 Network Load Balancer (NLB)

| 항목 | 값 |
|------|-----|
| **유형** | Internet-facing, Network Load Balancer |
| **서브넷** | Public Subnets (2 AZs) |
| **리스너** | TCP :4317 (gRPC), TCP :4318 (HTTP) |
| **Cross-zone** | 활성화 |

- 개발자 PC에서 전송하는 OTLP 트래픽의 진입점
- TCP 레벨 로드 밸런싱으로 gRPC와 HTTP 프로토콜 모두 지원
- NLB는 L4 로드 밸런서로, TLS 종료 없이 TCP 패킷을 그대로 전달 (프로덕션 배포 시 TLS 추가 권장)

### 3.2 ADOT Collector (ECS Fargate)

| 항목 | 값 |
|------|-----|
| **컨테이너 이미지** | `public.ecr.aws/aws-observability/aws-otel-collector:latest` |
| **리소스** | 0.5 vCPU / 1 GB Memory |
| **오토스케일링** | 최소 1, 최대 5 태스크 (CPU 70% 기준) |
| **서브넷** | Private Subnets (Public IP 없음) |
| **헬스체크** | NLB Target Group HTTP 헬스체크 (포트 13133) |
| **배포 안정성** | Circuit Breaker 활성화 (실패 시 자동 롤백) |

ADOT Collector는 OpenTelemetry Collector의 AWS 배포판으로, 다음 두 파이프라인을 처리합니다:

**메트릭 파이프라인:**
```
Receiver (OTLP) → Processor (batch, 60s/1000개) → Exporter (prometheusremotewrite → AMP)
```

**이벤트(로그) 파이프라인:**
```
Receiver (OTLP) → Processor (batch, 10s/500개) → Exporter (awscloudwatchlogs → CW Logs)
```

ADOT Collector 설정은 `config/adot-collector-config.yaml`에 정의되며, ECS 태스크의 `AOT_CONFIG_CONTENT` 환경변수로 주입됩니다. AMP 접근은 SigV4 인증 extension을 사용합니다.

> **참고**: ADOT Collector v0.40.0 이미지는 scratch 기반으로, 셸(wget/curl 등)이 포함되어 있지 않아 ECS 컨테이너 레벨 헬스체크를 사용할 수 없습니다. 따라서 NLB Target Group의 HTTP 헬스체크(포트 13133)에만 의존합니다.

### 3.3 Amazon Managed Prometheus (AMP)

| 항목 | 값 |
|------|-----|
| **역할** | 시계열 메트릭 저장 및 PromQL 쿼리 |
| **데이터 수신** | Prometheus Remote Write (SigV4 인증) |
| **저장 메트릭** | 8종 (세션, 토큰, 비용, 코드 라인, 커밋, PR, 활성 시간, 도구 결정) |
| **쿼리** | Grafana에서 PromQL로 조회 |

AMP는 완전 관리형 Prometheus 호환 서비스로, 인프라 관리 없이 메트릭을 저장하고 쿼리할 수 있습니다. ADOT Collector가 Remote Write API를 통해 메트릭을 전송하며, Grafana가 PromQL 쿼리를 통해 데이터를 조회합니다.

### 3.4 CloudWatch Logs + Subscription Filter

| 항목 | 값 |
|------|-----|
| **로그 그룹** | `/claude-code/telemetry-events` |
| **역할** | ADOT Collector가 이벤트를 기록하는 중간 저장소 |
| **Subscription Filter** | Firehose Delivery Stream으로 실시간 전달 |

ADOT Collector의 `awscloudwatchlogs` exporter가 이벤트 로그를 CloudWatch Logs에 기록하면, Subscription Filter가 이를 실시간으로 Kinesis Data Firehose에 전달합니다.

> **설계 배경**: 최초 설계에서는 `awskinesisfirehose` exporter를 통해 ADOT에서 Firehose로 직접 전송하는 방식이었으나, 해당 exporter가 ADOT/OTel Collector에 존재하지 않아 `awscloudwatchlogs` → Subscription Filter → Firehose 경로로 변경되었습니다.

### 3.5 Amazon Data Firehose + Lambda Transformer

| 항목 | 값 |
|------|-----|
| **소스** | CloudWatch Logs Subscription Filter |
| **대상** | S3 (Parquet 형식 변환) |
| **버퍼링** | 128 MB / 300초 |
| **형식 변환** | JSON → Parquet (Snappy 압축) |
| **파티셔닝** | 동적 파티셔닝 (year/month/day/hour) |
| **Lambda Transformer** | CW Logs 엔벨로프 디코딩 + OTLP JSON → 평면 JSON 변환 |

Subscription Filter에서 전달된 데이터는 CW Logs 엔벨로프(base64 + gzip)로 래핑되어 있습니다. Lambda Transformer(`lambda/firehose-transformer/index.py`)가 다음 처리를 수행합니다:

1. Base64 디코딩 및 gzip 해제
2. CW Logs 엔벨로프에서 `logEvents[].message` 추출 (CONTROL_MESSAGE 필터링)
3. OTLP JSON을 Glue 스키마 호환 평면 JSON으로 변환
4. Newline-delimited JSON으로 결합하여 Firehose에 반환

Firehose는 Glue Data Catalog 스키마를 참조하여 JSON을 Parquet 형식으로 자동 변환합니다.

### 3.6 Amazon S3

| 항목 | 값 |
|------|-----|
| **파일 형식** | Apache Parquet (Snappy 압축) |
| **파티셔닝** | Hive 스타일 (`year=/month=/day=/hour=`) |
| **퍼블릭 접근** | 전면 차단 (Block All Public Access) |
| **암호화** | S3 관리형 암호화 (SSE-S3) |
| **삭제 정책** | RETAIN (스택 삭제 시 버킷 보존) |
| **액세스 로그** | 별도 S3 버킷에 서버 액세스 로그 저장 |

**수명주기 정책:**

| 기간 | 스토리지 클래스 |
|------|----------------|
| 0 ~ 90일 | S3 Standard |
| 90 ~ 365일 | S3 Standard-IA |
| 365일 이후 | S3 Glacier Instant Retrieval |
| 730일 (2년) 이후 | 삭제 |
| 오류 레코드 30일 이후 | 삭제 |

### 3.7 AWS Glue Data Catalog

| 항목 | 값 |
|------|-----|
| **데이터베이스** | `claude_code_telemetry` |
| **테이블** | `events` (통합 스키마) |
| **파티션 관리** | S3 이벤트 기반 자동 등록 (Glue `BatchCreatePartition` API) |

Glue Data Catalog은 S3에 저장된 Parquet 데이터의 메타데이터 스토어 역할을 합니다. Firehose가 S3에 새 Parquet 파일을 쓰면 S3 ObjectCreated 이벤트 → EventBridge → Lambda를 통해 Glue `BatchCreatePartition` API로 파티션을 실시간 등록합니다. 이를 통해 Glue Crawler와 Athena MSCK 비용 없이 수 초 내 파티션이 인식됩니다. `AlreadyExistsException` 처리로 멱등성이 보장됩니다.

### 3.8 Amazon Athena

| 항목 | 값 |
|------|-----|
| **역할** | S3 Parquet 데이터에 대한 SQL 쿼리 |
| **테이블** | `claude_code_telemetry.events` |
| **최적화** | 파티션 프루닝 (year/month/day/hour 필터) |

Athena는 서버리스 SQL 쿼리 엔진으로, Grafana의 Athena 데이터 소스 플러그인을 통해 Tool Analytics와 API Performance 대시보드에 데이터를 제공합니다. 파티션 키를 WHERE 조건에 포함하면 스캔 범위를 크게 줄여 비용과 성능을 최적화할 수 있습니다.

### 3.9 Amazon Managed Grafana

| 항목 | 값 |
|------|-----|
| **인증** | AWS IAM Identity Center (SSO) |
| **데이터 소스** | Prometheus (AMP), Athena |
| **대시보드** | 6종 (Overview 1종 + Prometheus 1종 + Athena 4종) |
| **총 패널** | 80개 (JSON 전수 검증 기준) |
| **버전** | Grafana 10.4 |

Managed Grafana는 6개 프로덕션 수준 대시보드(총 80패널, JSON 전수 검증 기준)를 통해 Claude Code 텔레메트리를 시각화합니다. 게이지 패널, 스파크라인, 그라디언트 채움, 임계값 기반 색상, 테이블 셀 컬러링, 드릴다운 데이터 링크 등 운영 환경에 적합한 시각화를 제공합니다. **설계 철학**: Prometheus는 실시간 집계 메트릭(카운터/비율)에, Athena는 이벤트 레벨 심층 분석에 특화하여 두 데이터 소스 간 중복 없이 역할을 분리합니다. Overview 대시보드가 양쪽 데이터 소스를 통합하여 전체 진입점 역할을 합니다.

**통합 대시보드 (Prometheus + Athena, 1종 17패널)**:

| 대시보드 | 패널 | 설명 | 데이터 소스 |
|----------|------|------|-------------|
| **Overview** | 17 | 핵심 KPI 통합 요약(세션/비용/토큰/활성시간/커밋/PR). 스파크라인, 임계값 색상, 드릴다운 링크. 모든 대시보드의 진입점 | Prometheus (AMP) + Athena |

**Prometheus(AMP) 기반 대시보드 (실시간 메트릭, 1종 18패널)**:

| 대시보드 | 패널 | 설명 | 데이터 소스 |
|----------|------|------|-------------|
| **Real-Time Metrics** | 18 | 게이지(캐시 히트율/수락률), 스파크라인, 그라디언트 채움, 드릴다운 링크. 30초 자동 새로고침 | Prometheus (AMP) |

**Athena 기반 대시보드 (이벤트 심층 분석, 4종 45패널)**:

| 대시보드 | 패널 | 설명 | 데이터 소스 |
|----------|------|------|-------------|
| **Cost Deep Analysis** | 10 | 임계값 색상, 테이블 셀 컬러링, 요청 단위 비용 분석, 캐시 효율, 에러 비용 낭비 | Athena |
| **Usage & Session Insights** | 10 | 테이블 셀 컬러링, 세션 흐름, 프롬프트 복잡도, 게이지 셀 | Athena |
| **Tool Analytics** | 12 | 게이지(성공률/수락률), 그라디언트 바 차트, 테이블 셀 컬러링, 성공률 추이 | Athena |
| **API Performance** | 13 | 게이지(에러율), 그라디언트 채움, 임계값 라인, 테이블 셀 컬러링, 레이턴시-처리량 상관관계 | Athena |

> **변경 이력**: 초기 설계에서는 AMP(PromQL) 기반 4종 + Athena(SQL) 기반 2종 총 6종으로 계획하였으나, 메트릭 파이프라인의 delta temporality 문제로 AMP 데이터가 미가용하여 모든 대시보드를 Athena 기반으로 통합 재설계(5종 60패널). 이후 메트릭 파이프라인을 cumulative temporality로 수정하여 AMP 수신을 복구하고 Real-Time Metrics 대시보드를 추가(6종 74패널). Prometheus/Athena 간 중복 23패널을 제거하여 5종 52패널로 정리. Prometheus + Athena 통합 Overview 대시보드를 추가하여 6종 64패널 구조로 확정. 최종적으로 DA 스펙 기반 프로덕션 수준 시각화 개선을 적용하여 현재 6종 80패널 구조로 확정 (Grafana JSON 전수 검증 기준).

대시보드 JSON 정의는 `grafana/dashboards/` 디렉토리에 있으며, Grafana 워크스페이스에 수동으로 임포트하여 사용합니다.

---

## 4. 데이터 흐름

### 4.1 메트릭 경로 (Metrics Pipeline)

```
Claude Code (OTel SDK, cumulative temporality 필수)
    | OTLP Metrics (counter: session, token, cost, lines, commit, PR, active_time, tool_decision)
    v
NLB (:4317 gRPC / :4318 HTTP)
    |
    v
ADOT Collector
    | otlp receiver → memory_limiter → batch/metrics (60s, 1000건)
    | → prometheusremotewrite exporter (SigV4 인증, resource_to_telemetry_conversion: true)
    v
AMP (Amazon Managed Prometheus)
    | PromQL 쿼리
    v
Grafana (Real-Time Metrics 대시보드)
```

> **주의**: `prometheusremotewrite` exporter는 **cumulative temporality만 지원**합니다. Delta temporality 메트릭은 경고 없이 삭제됩니다. 클라이언트에서 `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative`을 설정하거나 미설정(기본값 cumulative)으로 두어야 합니다. ADOT에는 `deltatocumulative` 프로세서가 포함되어 있지 않아 서버 측 변환은 불가능합니다.

**AMP에 저장되는 메트릭 (8종):**

| Prometheus 메트릭 이름 | 설명 | 주요 레이블 |
|------------------------|------|-------------|
| `claude_code_session_count` | 세션 시작 횟수 | organization_id, user_id, session_id |
| `claude_code_lines_of_code_count` | 코드 변경 라인 수 | organization_id, user_id, type |
| `claude_code_pull_request_count` | PR 생성 수 | organization_id, user_id |
| `claude_code_commit_count` | 커밋 수 | organization_id, user_id |
| `claude_code_cost_usage` | 비용 (USD) | organization_id, user_id, model |
| `claude_code_token_usage` | 토큰 사용량 | organization_id, user_id, model, type |
| `claude_code_code_edit_tool_decision` | 코드 편집 도구 결정 | organization_id, user_id, tool_name, decision, source |
| `claude_code_active_time_total` | 활성 시간 (초) | organization_id, user_id, type |

### 4.2 이벤트 경로 (Events Pipeline)

```
Claude Code (OTel SDK)
    | OTLP Logs (events: user_prompt, tool_result, api_request, api_error, tool_decision)
    v
NLB (:4317 gRPC / :4318 HTTP)
    |
    v
ADOT Collector
    | otlp receiver → batch processor (10s, 500건) → awscloudwatchlogs exporter
    v
CloudWatch Logs (/claude-code/telemetry-events)
    | Subscription Filter
    v
Kinesis Data Firehose
    | Lambda Transformer:
    |   - CW Logs 엔벨로프 (base64 + gzip) 디코딩
    |   - OTLP JSON → 평면 JSON 변환
    | DataFormatConversion: JSON → Parquet (Glue 스키마 참조)
    | 동적 파티셔닝 (year/month/day/hour)
    | 버퍼링: 128 MB / 300초
    v
S3 (Parquet, Snappy)
    | s3://bucket/year=YYYY/month=MM/day=DD/hour=HH/*.parquet
    |
    +---> S3 ObjectCreated Event → EventBridge → Lambda → Glue BatchCreatePartition (실시간 파티션 등록)
    |
    v
Glue Data Catalog (이벤트 기반 파티션 관리)
    |
    v
Athena (SQL 쿼리)
    |
    v
Grafana (Overview + Athena 대시보드 4종: Cost, Usage, Tool, API)
```

**이벤트 유형:**

| 이벤트 이름 | 설명 | 주요 필드 |
|-------------|------|-----------|
| `claude_code.user_prompt` | 사용자 프롬프트 입력 | prompt_length |
| `claude_code.tool_result` | 도구 실행 결과 | tool_name, success, duration_ms, error |
| `claude_code.api_request` | API 호출 완료 | model, cost_usd, duration_ms, input_tokens, output_tokens |
| `claude_code.api_error` | API 호출 오류 | model, error, status_code, attempt |
| `claude_code.tool_decision` | 도구 사용 결정 | tool_name, decision, source |

---

## 5. 스택 구조 및 의존성

### 5.1 Nested Stack 아키텍처

전체 인프라는 **단일 루트 스택(TelemetryStack)**과 **5개의 NestedStack**으로 구성됩니다. `npx cdk deploy TelemetryStack` 한 번으로 전체 인프라를 배포/업데이트할 수 있습니다.

```
TelemetryStack (루트 스택)
  |
  +-- NetworkNestedStack         (NestedStack)
  +-- MetricsNestedStack         (NestedStack)
  +-- EventsNestedStack          (NestedStack)
  +-- CollectorNestedStack       (NestedStack)  <- Network, Metrics, Events에 의존
  +-- DashboardNestedStack       (NestedStack)  <- Metrics, Events에 의존
```

### 5.2 Nested Stack 의존성 다이어그램

```
[병렬 생성] NetworkNestedStack + MetricsNestedStack + EventsNestedStack
                  |                     |                    |
                  +---------------------+--------+-----------+
                                        |        |
[의존성 해결 후]              CollectorNestedStack  DashboardNestedStack
```

CDK가 Props를 통한 리소스 참조에서 자동으로 의존성을 추론합니다. 명시적 `addDependency()` 호출이 불필요합니다.

### 5.3 Nested Stack 상세

#### NetworkNestedStack (의존성 없음)

| 리소스 | 설명 |
|--------|------|
| VPC | 2 AZ, Public + Private 서브넷 |
| NAT Gateway | 1개 (Private 서브넷의 인터넷 접근용) |
| Security Group | OTLP gRPC/HTTP + 헬스체크 포트 허용 (VPC CIDR 제한) |
| VPC Flow Logs | VPC 트래픽 로깅 |

**출력값:** VPC, Security Group (CollectorNestedStack에서 참조)

#### MetricsNestedStack (의존성 없음)

| 리소스 | 설명 |
|--------|------|
| AMP Workspace | Prometheus 메트릭 저장소 |

**출력값:** Workspace ARN, Workspace ID, Remote Write URL (CollectorNestedStack, DashboardNestedStack에서 참조)

#### EventsNestedStack (의존성 없음)

| 리소스 | 설명 |
|--------|------|
| S3 Bucket | 이벤트 Parquet 파일 저장 |
| S3 Access Log Bucket | S3 서버 액세스 로그 저장 |
| Glue Database | `claude_code_telemetry` |
| Glue Table | `events` (통합 스키마, 이벤트 기반 파티션 등록) |
| CloudWatch Log Group | `/claude-code/telemetry-events` (ADOT 이벤트 로그) |
| Subscription Filter | CW Logs → Firehose 실시간 전달 |
| Firehose | JSON → Parquet 변환 및 S3 전달 |
| Lambda Transformer | CW Logs 엔벨로프 디코딩 + 데이터 변환 |
| Partition Register Lambda | S3 ObjectCreated → Glue BatchCreatePartition (실시간 파티션 등록) |
| EventBridge Rule | S3 ObjectCreated 이벤트 → Partition Register Lambda 트리거 |
| Firehose IAM Role | S3 쓰기 + Glue 읽기 + CloudWatch 로깅 |

**출력값:** Log Group Name, Log Group ARN, Glue DB Name, Bucket ARN (CollectorNestedStack, DashboardNestedStack에서 참조)

#### CollectorNestedStack (NetworkNestedStack, MetricsNestedStack, EventsNestedStack에 의존)

| 리소스 | 설명 |
|--------|------|
| ECS Cluster | Container Insights 활성화 |
| Fargate Task Definition | 0.5 vCPU / 1 GB, ADOT 컨테이너 |
| Fargate Service | 오토스케일링 (1~5), Private 서브넷, Circuit Breaker 활성화 |
| NLB | Internet-facing, gRPC/HTTP 리스너 |
| Target Groups | gRPC (:4317), HTTP (:4318), Deregistration Delay 30초 |
| Task Execution Role | ECR 풀, CloudWatch 로깅 |
| Task Role | AMP RemoteWrite + CW Logs PutLogEvents |

**출력값:** NLB DNS Name (OTLP 엔드포인트)

**최적화 적용사항:**
- NLB Target Group 헬스체크: `healthyThresholdCount: 2`, `interval: 10초` (배포 시간 단축)
- Deregistration Delay: 300초 → 30초 (롤링 업데이트 시간 단축)
- Circuit Breaker: 배포 실패 시 자동 롤백
- ECS 컨테이너 헬스체크 미사용 (ADOT scratch 이미지에 셸 없음)

#### DashboardNestedStack (MetricsNestedStack, EventsNestedStack에 의존)

| 리소스 | 설명 |
|--------|------|
| Grafana Workspace | SSO 인증, Prometheus + Athena 데이터 소스 |
| Grafana IAM Role | AMP 쿼리 + Athena 실행 + Glue 읽기 + S3 접근 |

**출력값:** Grafana Endpoint URL, Workspace ID

### 5.4 Nested Stack 간 파라미터 흐름

| 소스 스택 | 출력값 | 소비 스택 |
|-----------|--------|-----------|
| NetworkNestedStack | VPC, Security Group | CollectorNestedStack |
| MetricsNestedStack | AMP ARN, Remote Write URL | CollectorNestedStack |
| MetricsNestedStack | AMP ARN, Workspace ID | DashboardNestedStack |
| EventsNestedStack | Log Group Name, Log Group ARN | CollectorNestedStack |
| EventsNestedStack | Glue DB Name, Bucket ARN | DashboardNestedStack |

### 5.5 Nested Stack 구조의 이점

| 항목 | 독립 스택 (이전) | Nested Stack (현재) |
|------|-----------------|-------------------|
| **배포 명령** | `npx cdk deploy --all` (5개 스택 순서 관리 필요) | `npx cdk deploy TelemetryStack` (단일 명령) |
| **롤백** | 스택별 개별 롤백, 일관성 보장 어려움 | 원자적 롤백 (루트 스택 실패 시 전체 롤백) |
| **크로스 스택 참조** | CloudFormation Export/Import 잠금 | CDK 자동 파라미터 전달 (잠금 없음) |
| **삭제** | 역방향 의존성 순서로 개별 삭제 | `npx cdk destroy TelemetryStack` (단일 명령) |
| **운영** | 5개 스택 상태 개별 추적 | 루트 스택 1개만 추적 |

---

## 6. 보안 아키텍처

### 6.1 네트워크 보안

```
Internet
    |
    | (NLB: Public Subnets)
    |
    +-- Security Group: VPC CIDR 제한 (4317, 4318, 13133)
    |
    v
Private Subnets (ECS Fargate)
    |
    | (NAT Gateway: Private → Internet)
    |
    +-- AWS API 호출 (AMP, CW Logs, ECR, CloudWatch)
```

- **ECS 태스크**: Private 서브넷에 배치되어 직접적인 인터넷 접근 불가 (Public IP 미할당)
- **NLB**: Public 서브넷에 위치하여 개발자 PC의 OTLP 트래픽 수신
- **NAT Gateway**: Private 서브넷의 ECS 태스크가 AWS API에 접근할 수 있도록 아웃바운드 트래픽 허용
- **Security Group**: 인바운드 포트 4317, 4318, 13133을 VPC CIDR 범위로 제한
- **VPC Flow Logs**: VPC 트래픽 로깅 활성화

> **프로덕션 권장사항**: Security Group의 인바운드 소스를 회사 IP 대역으로 추가 제한하고, NLB에 TLS 종료를 추가하세요.

### 6.2 IAM 최소 권한 원칙

각 서비스 역할은 필요한 최소한의 권한만 보유합니다:

| IAM 역할 | 허용 액션 | 리소스 범위 |
|----------|----------|-------------|
| ECS Task Execution Role | ECS 태스크 실행 (이미지 풀, 로그 전송) | 관리형 정책 |
| ECS Task Role | `aps:RemoteWrite` | 특정 AMP 워크스페이스 |
| ECS Task Role | `logs:PutLogEvents`, `CreateLogStream`, `DescribeLogGroups`, `DescribeLogStreams` | 특정 CW Logs 로그 그룹 |
| Firehose Role | S3 읽기/쓰기 | 특정 이벤트 버킷 |
| Firehose Role | Glue 테이블 읽기 | 특정 DB/테이블 |
| Firehose Role | CloudWatch 로깅 | 특정 로그 그룹 |
| Lambda Transformer Role | CloudWatch Logs 읽기 | 기본 Lambda 실행 역할 |
| Grafana Role | AMP 쿼리 | 특정 AMP 워크스페이스 |
| Grafana Role | Athena 쿼리 실행 | 워크그룹 |
| Grafana Role | Glue 카탈로그 읽기 | 특정 DB/테이블 |
| Grafana Role | S3 읽기 + Athena 결과 쓰기 | 이벤트 버킷 + 결과 버킷 |

### 6.3 암호화

| 대상 | 암호화 방식 |
|------|-------------|
| S3 (저장 데이터) | SSE-S3 (S3 관리형 키) |
| AMP (저장 메트릭) | AWS 관리형 암호화 (기본값) |
| Firehose (전송 중) | TLS |
| ADOT → AMP | SigV4 인증 + HTTPS |
| ADOT → CW Logs | SigV4 인증 + HTTPS |
| NLB → ADOT | TCP (평문) - VPC 내부 통신 |

### 6.4 데이터 보호

- **S3 퍼블릭 접근**: 전면 차단 (`BlockPublicAccess.BLOCK_ALL`)
- **S3 삭제 정책**: `RETAIN` (스택 삭제 시 버킷 보존)
- **S3 버저닝**: 비활성화 (로그 데이터 특성상 불필요)
- **S3 액세스 로그**: 별도 버킷에 서버 액세스 로그 저장
- **개인정보**: 사용자 프롬프트 내용은 기본적으로 수집하지 않음 (`OTEL_LOG_USER_PROMPTS=1`로 명시적 활성화 필요)

---

## 7. 확장성 고려사항

### 7.1 수집 계층 (ADOT Collector)

- **수평 확장**: ECS 오토스케일링으로 CPU 70% 기준 1~5 태스크 자동 조절
- **NLB**: Cross-zone 로드 밸런싱으로 2 AZ에 균등 분배
- **배치 처리**: 메트릭은 60초/1000건, 이벤트는 10초/500건 단위로 배치하여 백엔드 부하 감소
- **확장 시 고려**: 200명 이상 규모에서는 `maxCapacity`를 10 이상으로 늘리고, Fargate CPU/메모리도 상향 검토

### 7.2 메트릭 저장 (AMP)

- AMP는 관리형 서비스로 자동 확장됨
- **카디널리티 관리**: `session.id` 레이블 비활성화로 메트릭 카디널리티 제어 가능 (`OTEL_METRICS_INCLUDE_SESSION_ID=false`)
- 개발자 수 증가 시 수집 비용(active metric series)에 주의

### 7.3 이벤트 저장 (CW Logs → Firehose → S3)

- Firehose는 초당 수천 건의 레코드를 자동 처리
- **CloudWatch Logs**: 중간 저장소로서 Subscription Filter를 통해 실시간 전달. 보존 기간 설정으로 비용 관리
- **Lambda Transformer**: CW Logs 엔벨로프 디코딩 처리. 대규모 팀에서는 Lambda 동시 실행 수 모니터링 필요
- **버퍼링 최적화**: 대규모 팀에서는 버퍼 크기를 줄여 (예: 64 MB / 120초) 데이터 가용성 향상 가능
- **S3 수명주기**: 장기 비용 관리를 위해 3단계 스토리지 전환 적용 (Standard → IA → Glacier)
- **이벤트 기반 파티션 등록**: S3 ObjectCreated → EventBridge → Lambda → Glue BatchCreatePartition으로 수 초 내 파티션 자동 등록. Glue Crawler 및 Athena MSCK 불필요

### 7.4 쿼리 계층 (Athena)

- Athena는 서버리스로 동시 쿼리 수에 따라 자동 확장
- **쿼리 비용 최적화**: Parquet(열 형식) + 파티션 프루닝으로 스캔 데이터량 최소화
- **대시보드 캐싱**: Grafana의 쿼리 캐시 설정으로 반복 쿼리 비용 절감 가능

### 7.5 고가용성

| 컴포넌트 | HA 구성 |
|----------|---------|
| VPC | 2 AZ |
| NLB | Cross-zone 활성화, 2 AZ 분산 |
| ECS | Multi-AZ 배치, 오토스케일링, Circuit Breaker |
| AMP | 관리형 (자동 HA) |
| S3 | 관리형 (99.999999999% 내구성) |
| Firehose | 관리형 (자동 HA) |
| Lambda | 관리형 (자동 HA) |
| Athena | 관리형 (서버리스) |
| Grafana | 관리형 (자동 HA) |

> **참고**: NAT Gateway는 단일 AZ에 1개만 배포됩니다. 프로덕션 환경에서는 `natGateways: 2`로 변경하여 AZ 장애 시 ECS 태스크의 인터넷 접근성을 보장하는 것을 권장합니다.
