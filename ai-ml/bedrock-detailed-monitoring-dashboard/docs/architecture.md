# 아키텍처

## 시스템 개요

Bedrock Claude Code Monitor는 Amazon Bedrock에서 Claude 모델 사용량을 실시간으로 수집, 집계, 시각화하는 모니터링 시스템입니다. CloudWatch 메트릭을 1분 단위로 수집하여 DynamoDB에 다단계로 집계하고, Next.js 기반 대시보드에서 비용, 토큰 사용량, 레이턴시, 캐시 효율을 시각화합니다.

시스템은 **데이터 수집 파이프라인**과 **웹 애플리케이션** 두 개의 독립적인 CDK 스택으로 구성되며, DynamoDB 테이블을 공유 인터페이스로 사용합니다.

## 아키텍처 다이어그램

```
                        ┌──────────────────────────────────────────────────┐
                        │              DataPipelineStack                    │
                        │                                                  │
  ┌─────────────┐       │  ┌──────────────┐     ┌────────────────────┐    │
  │ CloudWatch  │       │  │ EventBridge  │     │ Lambda Aggregator  │    │
  │ AWS/Bedrock │◄──────┼──│ (1분 간격)   │────►│ (Python 3.12)      │    │
  │ Namespace   │       │  └──────────────┘     └────────┬───────────┘    │
  └─────────────┘       │                                │                 │
                        │                     ┌──────────▼──────────┐     │
                        │                     │     DynamoDB        │     │
                        │                     │ BedrockUsageMetrics │     │
                        │                     │ (단일 테이블 설계)    │     │
                        │                     └──────────┬──────────┘     │
                        └────────────────────────────────┼────────────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────┐
                        │              WebAppStack       │                 │
                        │                                │                 │
  ┌──────────┐    ┌────────────┐    ┌─────────────┐    │                 │
  │ 브라우저  │    │ CloudFront │    │ Internal ALB│    │                 │
  │ (사용자)  │───►│  (HTTPS)   │───►│ (VPC Origin)│    │                 │
  └──────────┘    └────────────┘    └──────┬──────┘    │                 │
                                    ┌──────▼──────┐    │                 │
                                    │ ECS Fargate │    │                 │
                                    │ Next.js 15  │────┘                 │
                                    │  (ARM64)    │──────► CloudWatch    │
                                    └─────────────┘    (실시간 조회)      │
                        │                                                  │
                        │  ┌─────────┐  ┌────────────┐  ┌──────────┐     │
                        │  │   VPC   │  │  Private   │  │  NAT GW  │     │
                        │  │ (2 AZ)  │  │  Subnet    │  │          │     │
                        │  └─────────┘  └────────────┘  └──────────┘     │
                        └──────────────────────────────────────────────────┘
```

## 컴포넌트 상세

### Lambda Aggregator

**역할**: CloudWatch에서 Bedrock 사용 메트릭을 1분마다 수집하고, 비용을 계산하여 DynamoDB에 4단계 granularity로 기록합니다.
**기술**: Python 3.12, boto3, 512MB 메모리, 60초 타임아웃
**연동**: CloudWatch (읽기), DynamoDB (쓰기)

수집하는 CloudWatch 메트릭:
| 메트릭명 | 통계 | 설명 |
|----------|------|------|
| `Invocations` | Sum | 모델 호출 횟수 |
| `InputTokenCount` | Sum | 입력 토큰 수 |
| `OutputTokenCount` | Sum | 출력 토큰 수 |
| `CacheReadInputTokenCount` | Sum | 캐시 읽기 토큰 수 |
| `CacheWriteInputTokenCount` | Sum | 캐시 쓰기 토큰 수 |
| `InvocationLatency` | Average | 평균 응답 지연 시간 (ms) |

기록하는 DynamoDB 레코드 유형:
- **METRIC#minute**: 1분 단위 스냅샷 (TTL 7일)
- **METRIC#hourly**: 시간 단위 누적 집계 (TTL 90일)
- **METRIC#daily**: 일 단위 누적 집계 (영구 보관)
- **CUMULATIVE**: 월별 누적 비용 및 토큰 합계 (영구 보관)

### Next.js 웹 애플리케이션

**역할**: 대시보드 UI와 REST API를 제공하는 풀스택(Full-stack) 웹 애플리케이션입니다.
**기술**: Next.js 15, React 19, TypeScript, Tailwind CSS, ECharts (15종 차트), TanStack Query v5
**연동**: DynamoDB (이력 조회), CloudWatch (실시간 조회)

이중 데이터 경로를 사용합니다:
- **실시간 경로**: Next.js API Route가 CloudWatch `GetMetricData` API를 직접 호출하여 최신 데이터를 반환합니다.
- **이력 경로**: Next.js API Route가 DynamoDB를 조회하여 Lambda Aggregator가 집계한 과거 데이터를 반환합니다.

차트 컴포넌트 15종을 제공합니다 (일부 컴포넌트는 현재 페이지에 미사용):
- **Overview**: KpiGrid, CostInterval(전체 너비), TokenTimeSeries/CacheTimeSeries(2컬럼 그리드), CacheHitGauge(2/5)/ModelDonut(3/5)(5컬럼 비율 그리드), UsageHeatmap(전체 너비)
- **Cost Analysis**: DailyCostBar, CostSankey, CacheSavings, 일별 비용 테이블
- **Models**: ModelDonut, LatencyBoxplot, OutputInputRatio, CostEfficiencyScatter, 토큰 사용량 Stacked Bar
- **Trends**: CostPerInvocation, CacheHitTrend (+ 인라인 7일 이동평균, 피크 시간대 레이더)
- **Pricing**: 읽기 전용 가격 참조 테이블 + 현재 월 상태 요약 (차트 컴포넌트 없음, `/api/cost/forecast` 데이터만 사용)
- **미사용(보존)**: RegionalSavings (Cost 페이지에서 제거됨, 컴포넌트 파일은 보존)

### DynamoDB 테이블

**역할**: 모든 메트릭 데이터와 설정을 저장하는 중앙 데이터 저장소입니다.
**기술**: Amazon DynamoDB (On-Demand 모드, TTL 활성화, PITR 활성화)
**연동**: Lambda Aggregator (쓰기), Next.js API Routes (읽기 전용)

단일 테이블 설계(Single Table Design)를 채택하여, `pk`(Partition Key)와 `sk`(Sort Key) 조합으로 다양한 엔티티를 하나의 테이블에서 관리합니다.

### ECS Fargate 클러스터

**역할**: Next.js 웹 애플리케이션을 컨테이너로 실행합니다.
**기술**: AWS Fargate (512 CPU, 1024MB 메모리, ARM64/Graviton)
**연동**: ALB (트래픽 수신), DynamoDB/CloudWatch (AWS SDK 호출)

ARM64 아키텍처를 사용하여 Apple Silicon에서 빌드한 Docker 이미지와 호환되며, x86 대비 약 20% 비용 절감 효과가 있습니다.

### CloudFront Distribution

**역할**: 유일한 퍼블릭 진입점으로, TLS를 종단하고 VPC Origin을 통해 Internal ALB로 트래픽을 전달합니다.
**기술**: Amazon CloudFront (VPC Origin, CACHING_DISABLED, REDIRECT_TO_HTTPS)
**연동**: Internal ALB (VPC Origin, HTTP 80)

설정:
- `viewerProtocolPolicy`: REDIRECT_TO_HTTPS (클라이언트 ↔ CloudFront 구간 HTTPS 강제)
- `cachePolicy`: CACHING_DISABLED (실시간 대시보드, 60초 자동갱신)
- `originRequestPolicy`: ALL_VIEWER_EXCEPT_HOST_HEADER (쿼리파라미터 전달, Host 헤더 제외)
- `allowedMethods`: ALLOW_ALL (CDK 기본 설정, 향후 GET/HEAD만으로 축소 가능)

### Internal Application Load Balancer (ALB)

**역할**: VPC 내부에서 CloudFront로부터 전달받은 트래픽을 ECS Fargate 서비스로 전달합니다. 퍼블릭 네트워크에 노출되지 않습니다.
**기술**: AWS ALB (Internal, HTTP 80)
**연동**: ECS Fargate (대상 그룹, 포트 3000)

HTTP(80) 리스너만 구성되어 있으며(CloudFront가 TLS 종단), `/api/health` 엔드포인트로 헬스체크를 수행합니다.

## 데이터 흐름

### 메트릭 수집 흐름 (1분 주기)

1. **EventBridge**가 1분마다 Lambda Aggregator를 호출합니다.
2. **Lambda**가 CloudWatch `AWS/Bedrock` 네임스페이스에서 8개 모델의 6가지 메트릭을 조회합니다 (최근 2분 윈도우).
3. **Lambda**가 모델별 비용과 캐시 절감액을 계산합니다 (모델 패밀리별 가격 체계 적용).
4. **Lambda**가 DynamoDB에 4단계 레코드를 기록합니다:
   - `METRIC#minute` 레코드: 1분 스냅샷 (PUT)
   - `METRIC#hourly` 레코드: 시간 단위 누적 (ADD)
   - `METRIC#daily` 레코드: 일 단위 누적 (ADD)
   - `CUMULATIVE` 레코드: 월 누적 합계 (ADD)

### 대시보드 조회 흐름

1. **브라우저**가 Next.js 페이지를 로드하고, TanStack Query가 API를 호출합니다 (60초 자동 갱신).
2. **API Route**가 요청 유형에 따라 데이터 소스를 결정합니다:
   - `/api/metrics/realtime`: CloudWatch `GetMetricData` 직접 호출
   - `/api/metrics/history`: DynamoDB Query (pk + sk 범위 조건)
   - `/api/cost/summary`: DynamoDB GetItem (CUMULATIVE 레코드)
   - `/api/cost/forecast`: DynamoDB에서 당월 누적 + 최근 7일/14일 일별 데이터를 조회하여 예측 계산
3. **ECharts** 차트 컴포넌트가 JSON 데이터를 시각화합니다.

### 비용 계산 로직

비용은 모델 패밀리(Opus/Sonnet/Haiku)별 가격표를 기준으로 계산됩니다:

```
비용 = (입력토큰 * 입력가격 + 출력토큰 * 출력가격
       + 캐시쓰기토큰 * 캐시쓰기가격 + 캐시읽기토큰 * 캐시읽기가격) / 1,000,000

캐시 절감액 = 캐시읽기토큰 * (입력가격 - 캐시읽기가격) / 1,000,000
```

## DynamoDB 스키마 설계

### 키 패턴

| PK | SK 형식 | 설명 | TTL |
|----|---------|------|-----|
| `METRIC#minute` | `YYYY-MM-DDTHH:MM:SSZ` | 1분 단위 메트릭 스냅샷 | 7일 |
| `METRIC#hourly` | `YYYY-MM-DDTHH:00:00Z` | 시간 단위 누적 집계 | 90일 |
| `METRIC#daily` | `YYYY-MM-DD` | 일 단위 누적 집계 | 영구 |
| `CUMULATIVE` | `YYYY-MM` | 월별 누적 비용/토큰 | 영구 |

> **참고**: 이전에 존재하던 `SETTINGS#CONFIG` 레코드는 제거되었습니다. 모델별 가격 정보는 `webapp/src/lib/constants/pricing.ts`에서 코드로 관리됩니다.

### 메트릭 레코드 속성

각 메트릭 레코드(`METRIC#*`)는 모델 ID를 키(key)로 사용하는 Map 속성을 포함합니다:

- `invocations`: 모델별 호출 횟수
- `input_tokens`: 모델별 입력 토큰 수
- `output_tokens`: 모델별 출력 토큰 수
- `cache_read_tokens`: 모델별 캐시 읽기 토큰 수
- `cache_write_tokens`: 모델별 캐시 쓰기 토큰 수
- `cost`: 모델별 비용 (USD)
- `cache_savings`: 모델별 캐시 절감액 (USD)
- `latency_avg`: 모델별 평균 레이턴시 (ms)

## 주요 결정 사항

| 결정 | 이유 | 대안 검토 |
|------|------|----------|
| DynamoDB 단일 테이블 설계 | pk/sk 조합으로 다양한 granularity를 하나의 테이블에서 관리. TTL로 자동 데이터 정리. On-Demand 요금으로 비용 효율적 | 별도 테이블, TimeStream |
| CloudWatch + DynamoDB 이중 경로 | 실시간 데이터는 CloudWatch 직접 조회로 최신성 확보, 이력 데이터는 DynamoDB 집계 데이터로 비용/성능 최적화 | CloudWatch 단독 사용, Kinesis 스트리밍 |
| ECS Fargate ARM64(Graviton) | Apple Silicon 빌드 호환, x86 대비 약 20% 비용 절감 | x86 Fargate, App Runner, Lambda@Edge |
| Lambda Aggregator (Python) | boto3 내장으로 추가 의존성 불필요, CloudWatch/DynamoDB 연동에 적합 | Node.js Lambda, Step Functions |
| Next.js App Router + API Routes | 프론트엔드/백엔드를 단일 프로젝트로 관리, 서버 사이드 렌더링 지원, standalone 빌드로 컨테이너 최적화 | 별도 프론트엔드 + API 서버 |
| 가격 정보 코드 관리 (Settings API 제거) | Lambda와 웹앱이 동일한 가격 소스(`pricing.ts`)를 사용하여 일관성 보장. 런타임 가격 변경으로 인한 데이터 불일치 방지 | DynamoDB SETTINGS 레코드 기반 런타임 수정 |
| ECharts (15종 차트) | 풍부한 차트 유형(Sankey, Treemap, Heatmap, Radar, Gauge, Scatter 등) 지원, 서버사이드 렌더링 불필요한 클라이언트 차트. 게이지, 버블 스캐터, Area 라인 등 다양한 유형 활용 | Recharts, Nivo, Chart.js |
| TanStack Query (60초 자동 갱신) | 서버 상태 캐싱, 자동 리패치, 에러 핸들링을 선언적으로 관리 | SWR, Redux + Saga |

## CDK 스택 구성

### DataPipelineStack

데이터 수집 및 저장을 담당하는 스택입니다.

| 리소스 | 설정 |
|--------|------|
| DynamoDB 테이블 | `BedrockUsageMetrics`, On-Demand, TTL 활성화, PITR 활성화, RemovalPolicy.RETAIN |
| Lambda 함수 | `BedrockMetricsAggregator`, Python 3.12, 512MB, 60초 타임아웃 |
| EventBridge 규칙 | `BedrockMetricsAggregatorSchedule`, 1분 간격 |
| IAM 정책 | CloudWatch `GetMetricData`, DynamoDB `PutItem`/`UpdateItem`/`Query`/`GetItem` |

### WebAppStack

웹 애플리케이션 호스팅을 담당하는 스택입니다. `DataPipelineStack`에서 `tableName`과 `tableArn`을 전달받습니다.

| 리소스 | 설정 |
|--------|------|
| VPC | 2 AZ, Public/Private 서브넷, NAT Gateway 1개 |
| ECS Cluster | `bedrock-dashboard-cluster` |
| Fargate Task | 512 CPU, 1024MB, ARM64, standalone Next.js 컨테이너 |
| CloudFront | VPC Origin, CACHING_DISABLED, REDIRECT_TO_HTTPS, ALLOW_ALL |
| ALB | Internal, HTTP 80 (VPC 내부 전용) |
| 헬스체크 | `/api/health`, 30초 간격 |
| IAM 정책 | CloudWatch `GetMetricData`/`GetMetricStatistics`, DynamoDB `Query`/`GetItem`/`PutItem`/`UpdateItem` |

> **참고**: Settings API 제거 후 웹앱은 DynamoDB에 쓰기 작업을 수행하지 않습니다. `PutItem`/`UpdateItem` 권한은 CDK 스택에 잔존하며, 향후 정리 가능합니다.

## 보안 고려사항

- **네트워크 격리**: ECS Fargate 태스크는 Private 서브넷에, ALB는 Internal로 배치되어 직접적인 인터넷 접근이 차단됩니다. 외부 트래픽은 CloudFront VPC Origin을 통해서만 전달됩니다.
- **IAM 역할 기반 인증**: ECS 태스크 역할(Task Role)에 최소 권한 원칙을 적용하여 필요한 AWS 서비스에만 접근합니다.
- **HTTPS 전용**: CloudFront가 TLS를 종단하며, Viewer Protocol Policy REDIRECT_TO_HTTPS로 HTTPS를 강제합니다. CloudFront ↔ ALB 구간은 VPC 내부 HTTP 통신입니다.
- **DynamoDB 보안**: 테이블 접근은 IAM 정책으로 제한되며, PITR(Point-in-Time Recovery)이 활성화되어 있습니다.
- **컨테이너 보안**: Docker 이미지는 비루트(non-root) 사용자(`nextjs`)로 실행됩니다.
- **인증 미구현**: 현재 별도 인증이 설정되어 있지 않습니다. 프로덕션 환경에서는 CloudFront Functions + JWT, Cognito User Pool, 또는 WAF IP 화이트리스트를 추가해야 합니다.

## 성능 특성

| 항목 | 수치 |
|------|------|
| 메트릭 수집 주기 | 1분 |
| Lambda 실행 시간 | ~2-5초 (7개 모델, 6가지 메트릭) |
| DynamoDB 쓰기 | ~30 WCU/분 (4단계 집계) |
| 대시보드 자동 갱신 | 60초 (TanStack Query) |
| API 응답 시간 | ~100-300ms (DynamoDB 이력), ~500-2000ms (CloudWatch 실시간) |
| 분 데이터 보관 | 7일 (TTL 자동 삭제) |
| 시간 데이터 보관 | 90일 (TTL 자동 삭제) |
| 일/월 데이터 보관 | 영구 |
