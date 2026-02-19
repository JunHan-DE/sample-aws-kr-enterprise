# 프로젝트 진행 상황

## 현재 상태

**마지막 업데이트**: 2026-02-19 (Claude Sonnet 4.6 모델 추가)
**현재 단계**: 운영(Production)
**진행률**: 100% (전체 기능 구현, UI 개선, 프로덕션 배포 완료)

## 완료된 작업

### 2026-02-19 (Claude Sonnet 4.6 모델 추가)
- ✅ Claude Sonnet 4.6 모델(`global.anthropic.claude-sonnet-4-6`) 모니터링 대상 추가
- ✅ 모델 가격 정보 추가 (Input $3/MTok, Output $15/MTok, Cache Write $3.75/MTok, Cache Read $0.30/MTok)
- ✅ 4개 소스 파일 업데이트: `pricing.ts`, `metric-definitions.ts`, `index.py`, `backfill.py`
- ✅ 프로덕션 배포 완료 (DataPipelineStack + WebAppStack)
- ✅ 전체 문서 업데이트 (README, Architecture, API, Progress)

### 2026-02-13 (Pricing 페이지 리팩토링)
- ✅ Settings 페이지를 읽기 전용 Pricing 참조 페이지로 재설계 (`/settings` -> `/pricing`)
- ✅ Settings API 엔드포인트 제거 (`GET /api/settings`, `PUT /api/settings` 삭제)
- ✅ Pricing 페이지: 모델별 가격 참조 테이블(읽기 전용) + 현재 월 상태 요약(Daily Average, Projected Month-End, Trend)
- ✅ Sidebar 네비게이션 업데이트: "Settings" -> "Pricing" (아이콘: Coins)
- ✅ 전체 빌드, 타입 체크 통과 확인
- ✅ 코드 리뷰 완료
- ✅ 프로덕션 배포 완료 (ECS Fargate 이미지 업데이트)
- ✅ QA 검증 완료
- ✅ 전체 문서 업데이트 (README, Architecture, API, Development, Progress)

### 2026-02-13 (후반)
- ✅ Cost Analysis 페이지에서 `RegionalSavings` 차트 제거 (불필요한 리전별 비교 차트 정리)
- ✅ Overview 페이지 레이아웃 재배치: CostInterval 차트를 전체 너비(full-width)로 상단 배치
- ✅ Overview 페이지 중간 섹션을 3컬럼 그리드(Token Usage, Cache Usage, Cache Hit Rate)로 재구성
- ✅ UsageHeatmap 컴포넌트의 차트 겹침(overlap) 문제 해결
- ✅ Trends 페이지 UI 개선 (차트 간격 및 로딩 상태 최적화)
- ✅ 전체 빌드 및 타입 체크 통과 확인
- ✅ 코드 리뷰 완료
- ✅ 프로덕션 배포 완료 (최신 UI 변경사항 포함 ECS Fargate 이미지 업데이트)
- ✅ 전체 시스템 QA 검증 완료 (API 헬스체크, 메트릭 수집, 5개 페이지 정상 동작 확인)
- ✅ 문서 업데이트 (README, Architecture, API, Development, Progress)

### 2026-02-13 (전반)
- ✅ 차트 컴포넌트 6종 신규 추가 (총 10종 -> 15종, CostInterval 포함)
  - `CacheHitGauge`: Overview 페이지에 캐시 히트율 게이지 차트 추가
  - `RegionalSavings`: 리전별(US) vs 글로벌(Global) 비용 비교 차트 구현 (이후 Cost 페이지에서 제거)
  - `OutputInputRatio`: Models 페이지에 모델별 Input/Output 비용 비율 Stacked Bar 추가
  - `CostEfficiencyScatter`: Models 페이지에 비용 vs 레이턴시 버블 Scatter 차트 추가
  - `CostPerInvocation`: Trends 페이지에 모델 패밀리별 호출당 비용 추이 라인 차트 추가
  - `CacheHitTrend`: Trends 페이지에 캐시 히트율 추이 Area 라인 차트(80% 목표선 포함) 추가
- ✅ `pricing.ts`에 `MODEL_FAMILIES`, `FAMILY_COLORS` export 추가 (차트 컬러 표준화)
- ✅ `charts/index.ts` 배럴 export에 신규 6종 차트 등록
- ✅ 4개 대시보드 페이지(Overview, Cost, Models, Trends) UI에 신규 차트 통합
- ✅ 전체 빌드 및 QA 검증 완료
- ✅ 프로젝트 문서화 (README, Architecture, API, Development, Progress)
- ✅ 전체 시스템 배포 검증 완료 (API 헬스체크, 메트릭 수집, 대시보드 페이지 모두 정상)
- ✅ ALB HTTPS 리스너 구성 (ACM 인증서 연동, 포트 443만 사용)

### 2026-02-12
- ✅ Lambda Aggregator 구현 (Python 3.12, 1분 간격 CloudWatch 메트릭 수집)
- ✅ DynamoDB 단일 테이블 설계 및 4단계 granularity 집계 (분/시/일/월누적)
- ✅ CloudWatch 이력 데이터 백필 스크립트(`backfill.py`) 구현 및 실행
- ✅ Next.js 15 웹 애플리케이션 구현 (5개 페이지, 8개 API 엔드포인트)
- ✅ ECharts 기반 차트 컴포넌트 10종 구현
- ✅ ECS Fargate + ALB 인프라 CDK 스택 배포
- ✅ Docker 멀티스테이지 빌드 (Node.js 20 Alpine, standalone 모드)
- ✅ 모델별 가격 설정 기능 (Settings 페이지)
- ✅ 비용 예측 기능 (일평균 기반 월말 비용 추정, 7일 트렌드 비교)
- ✅ 커스텀 시간 범위 선택 기능 (Custom date range picker)

## 진행 중인 작업

현재 진행 중인 작업이 없습니다. 모든 핵심 기능이 구현되어 프로덕션에서 운영 중입니다.

> **최근 변경**: Settings 페이지가 읽기 전용 Pricing 참조 페이지로 전환되었습니다. 가격 정보는 코드(`pricing.ts`)에 하드코딩되어 Lambda Aggregator가 비용 계산 시 사용합니다. 런타임에서 가격을 변경할 수 있는 Settings API는 제거되었습니다.

## 다음 단계

1. 인증/인가 기능 추가 (ALB에 Cognito 또는 OIDC 인증 연동)
2. 알림 기능 구현 (비용 임계값 초과 시 SNS/Slack 알림)
3. NAT Gateway 제거 및 VPC 엔드포인트 전환 (월 비용 ~$32 절감)
4. CloudFront WAF 연동 (IP 화이트리스트, Rate Limiting)
5. 다중 리전(Multi-Region) 메트릭 수집 지원

## 블로커 / 이슈

| 이슈 | 영향 | 해결 방안 | 상태 |
|------|------|----------|------|
| ALB에 인증 미설정 | 퍼블릭 접근 가능 | Cognito User Pool 또는 IP 화이트리스트 적용 | 🟡 |
| NAT Gateway 비용 | 월 ~$32 추가 비용 | VPC 엔드포인트(DynamoDB, CloudWatch, ECR)로 전환 | 🟡 |
| Opus 모델 가격 테이블 불일치 | README 가격 표와 코드 내 가격이 다름 | 코드 기준(`pricing.ts`)이 정확한 값이므로 README 수정 완료 | 🟢 |
| Settings API 제거됨 | 런타임 가격 변경 불가 | 가격 변경은 `pricing.ts` 코드 수정 후 재배포로 처리 | 🟢 |

## 의사결정 로그

### 2026-02-13: Settings 페이지를 읽기 전용 Pricing 페이지로 전환

**배경**: Settings 페이지에서 모델별 가격을 런타임에 수정할 수 있었으나, 실제 비용 계산은 Lambda Aggregator가 하드코딩된 가격으로 수행하므로 웹 UI에서의 가격 수정이 일관성을 해칠 수 있었음
**선택지**: 1) Settings 페이지 유지 (가격 편집 기능 포함) 2) 읽기 전용 Pricing 참조 페이지로 전환 3) Settings 페이지 완전 제거
**결정**: 읽기 전용 Pricing 참조 페이지로 전환 (`/settings` -> `/pricing`)
**이유**: 가격 정보는 AWS Bedrock On-Demand 공식 가격 기반으로 코드에 정의되어 있으며, Lambda Aggregator와 웹앱이 동일한 가격표(`pricing.ts`)를 참조해야 일관성이 보장됨. Pricing 페이지는 현재 적용 중인 가격을 확인하는 참조용으로 충분하며, 가격 변경이 필요한 경우 `pricing.ts` 수정 후 재배포하는 것이 안전함. 불필요한 Settings API(`GET /PUT /api/settings`)도 함께 제거하여 공격 표면(attack surface)을 줄임.

### 2026-02-13: Cost 페이지에서 RegionalSavings 차트 제거

**배경**: Cost Analysis 페이지에 RegionalSavings(리전별 vs 글로벌 비용 비교) 차트가 포함되어 있었으나, 실질적 활용도가 낮았음
**선택지**: 1) 차트를 유지하되 접기(collapse) 처리 2) 차트 제거 3) 별도 탭으로 분리
**결정**: Cost 페이지에서 제거 (컴포넌트 파일은 보존)
**이유**: Cost 페이지의 핵심 분석 흐름(일별 비용 -> 비용 흐름 -> 캐시 절감 -> 일별 테이블)에 집중하기 위해 제거. 향후 필요 시 컴포넌트를 재사용할 수 있도록 `RegionalSavings.tsx` 파일 자체는 보존.

### 2026-02-13: Overview 페이지 레이아웃 재구성

**배경**: CostInterval 차트가 다른 차트와 같은 그리드에 배치되어 비용 추이 가독성이 떨어졌음
**선택지**: 1) 기존 그리드 유지 2) CostInterval을 전체 너비 상단으로 분리
**결정**: CostInterval을 KPI 카드 바로 아래 전체 너비(full-width)로 배치하고, Token Usage/Cache Usage/Cache Hit Rate를 3컬럼 그리드로 재구성
**이유**: 비용 추이가 대시보드에서 가장 중요한 정보이므로 최상단에 넓게 배치하여 가독성 향상. 3컬럼 구성으로 토큰/캐시/캐시 히트율을 한 눈에 비교 가능.

### 2026-02-13: 차트 컴포넌트 확장 (6종 추가)

**배경**: 대시보드의 분석 깊이를 높이기 위해 추가 시각화 요소가 필요
**선택지**: 1) 기존 차트에 탭으로 추가 2) 별도 컴포넌트로 신규 추가 3) 타사 대시보드 도구(Grafana 등) 연동
**결정**: 별도 컴포넌트로 신규 추가
**이유**: 기존 ECharts 기반 패턴을 그대로 활용하여 일관성을 유지하면서, 각 페이지의 분석 관점에 맞는 전용 차트를 추가. 게이지(Gauge), 버블 스캐터(Scatter), 영역 라인(Area), 비용 비율 바 차트 등 다양한 차트 유형을 도입하여 시각적 다양성 확보.

### 2026-02-12: DynamoDB 단일 테이블 설계 채택

**배경**: 메트릭 데이터를 분/시/일/월누적 4단계로 저장해야 함
**선택지**: 1) 단일 테이블(Single Table Design) 2) granularity별 별도 테이블 3) TimeStream
**결정**: 단일 테이블 설계
**이유**: 하나의 테이블에서 pk/sk 조합으로 모든 granularity를 처리할 수 있어 관리가 단순하며, On-Demand 요금으로 비용 효율적. TTL을 통해 분 단위 데이터(7일)와 시간 데이터(90일) 자동 삭제 가능.

### 2026-02-12: ECS Fargate ARM64(Graviton) 선택

**배경**: 웹 애플리케이션 컨테이너 실행 환경 선정
**선택지**: 1) Fargate x86_64 2) Fargate ARM64(Graviton) 3) App Runner
**결정**: Fargate ARM64
**이유**: Apple Silicon(M-시리즈)에서 로컬 빌드한 Docker 이미지와 아키텍처가 일치하며, Graviton은 x86 대비 약 20% 비용 절감 효과. Next.js standalone 빌드가 ARM64에서 정상 동작 확인.

### 2026-02-12: CloudWatch 직접 조회 vs DynamoDB 이력 이중 경로 채택

**배경**: 대시보드에서 실시간 데이터와 과거 이력 데이터를 모두 제공해야 함
**선택지**: 1) CloudWatch만 사용 2) DynamoDB만 사용 3) 이중 경로(실시간: CloudWatch, 이력: DynamoDB)
**결정**: 이중 경로
**이유**: CloudWatch는 최근 데이터에 대해 빠른 응답을 제공하지만, 장기 이력 조회 시 비용과 지연이 발생. Lambda가 1분마다 집계한 데이터를 DynamoDB에 저장하여 이력 조회 성능과 비용을 최적화.

## 내일 이어서 할 일

> 이 섹션만 읽으면 바로 작업 시작 가능

현재 시스템은 완전히 배포되어 운영 중입니다. 최신 변경사항(Settings -> Pricing 페이지 전환, Settings API 제거, Overview 레이아웃 재배치, Cost 페이지 RegionalSavings 제거)이 모두 프로덕션에 반영되었습니다.

1. **ALB 인증 추가**
   - 파일: `cdk/lib/webapp-stack.ts`
   - 할 일: ALB 리스너에 Cognito User Pool 인증 또는 OIDC 인증 액션 추가, 또는 CloudFront Functions + JWT 검증 방식 검토
   - 참고: 현재 ALB는 Internal HTTP(80) 리스너만 구성되어 있으며, CloudFront가 TLS를 종단합니다. 인증은 CloudFront 레벨 또는 ALB 레벨에서 추가 가능

2. **비용 알림 기능 구현**
   - 파일: 새로운 Lambda 함수 또는 기존 aggregator에 추가
   - 할 일: 일일 비용이 임계값 초과 시 SNS 토픽으로 알림 발송
   - 참고: `CUMULATIVE` 레코드의 `total_cost` 필드를 활용

3. **VPC 엔드포인트 전환**
   - 파일: `cdk/lib/webapp-stack.ts`
   - 할 일: NAT Gateway 제거 후 DynamoDB, CloudWatch Logs, ECR 용 VPC 엔드포인트 추가
   - 참고: 월 ~$32 비용 절감 가능

### 참고 컨텍스트

- 배포 리전: `us-east-1`
- CDK 스택: `DataPipelineStack` (데이터 파이프라인), `WebAppStack` (웹 애플리케이션)
- DynamoDB 테이블: `BedrockUsageMetrics` (단일 테이블 설계)
- 모니터링 대상: 8개 Claude 모델 (Opus 4.6, Opus 4.5, Opus 4.5 US, Sonnet 4.6, Sonnet 4.5, Haiku 4.5, Haiku 4.5 US, Haiku 3.5 US)
- Lambda Aggregator는 1분 간격으로 CloudWatch `AWS/Bedrock` 네임스페이스에서 메트릭을 수집하여 DynamoDB에 기록
- 차트 컴포넌트 총 15종 (ECharts 기반, `webapp/src/components/charts/` 디렉토리, `RegionalSavings`는 Cost 페이지에서 제거되었으나 컴포넌트는 보존)
- 대시보드 페이지 5개: Overview(`/`), Cost Analysis(`/cost`), Models(`/models`), Trends(`/trends`), Pricing(`/pricing`)
- Pricing 페이지는 읽기 전용 (모델별 가격 참조 테이블 + 현재 월 상태 요약). Settings API는 제거됨.
- 가격 변경은 `webapp/src/lib/constants/pricing.ts` 수정 후 재배포 필요
- Overview 레이아웃: KPI 카드 -> CostInterval(전체 너비) -> 2컬럼(Token/Cache) -> 5컬럼 비율(CacheHitGauge 2/5 + ModelDonut 3/5) -> UsageHeatmap
- Cost 레이아웃: 예측 카드 4장 -> DailyCostBar -> CostSankey -> CacheSavings -> 일별 비용 테이블

## 아카이브

<!-- 14일 이상 지난 완료 작업은 여기로 이동 -->

### 2026-02-04
- ✅ CloudWatch `AWS/Bedrock` 네임스페이스 메트릭 수집 기반 설계
- ✅ 지원 모델 7개 선정 (Opus 4.6, Opus 4.5, Sonnet 4.5, Haiku 4.5, Haiku 3.5)
