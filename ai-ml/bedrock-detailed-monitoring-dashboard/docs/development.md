# 개발 가이드

## 개발 환경 설정

### 필수 도구

| 도구 | 버전 | 설명 |
|------|------|------|
| Node.js | 20+ | 웹 애플리케이션 및 CDK 런타임 |
| npm | 10+ | 패키지 관리 (Node.js에 포함) |
| AWS CLI | 2.x | AWS 서비스 접근 및 자격 증명 관리 |
| AWS CDK CLI | 2.178+ | 인프라 배포 도구 (`npm install -g aws-cdk`) |
| Docker | 최신 | 컨테이너 빌드 (Docker Desktop 또는 colima) |
| Python | 3.12+ | Lambda 함수 로컬 테스트 및 백필 스크립트 (선택) |

### AWS 자격 증명

로컬 개발 및 CDK 배포에 AWS 자격 증명이 필요합니다.

```bash
# 방법 1: AWS CLI 프로필 설정
aws configure

# 방법 2: 환경 변수 설정
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=us-east-1
```

필요한 IAM 권한:
- `cloudwatch:GetMetricData`, `cloudwatch:GetMetricStatistics`
- `dynamodb:Query`, `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`

### 환경 변수

| 변수명 | 설명 | 기본값 | 사용 위치 |
|--------|------|--------|----------|
| `TABLE_NAME` | DynamoDB 테이블명 | `BedrockUsageMetrics` | Lambda, 웹앱 |
| `AWS_REGION` | AWS 리전 | `us-east-1` | 웹앱 |
| `PORT` | 웹서버 포트 | `3000` | 웹앱 (Docker) |
| `NODE_ENV` | Node.js 환경 | `development` (로컬), `production` (Docker) | 웹앱 |
| `DOCKER_HOST` | Docker 소켓 경로 | 자동 감지 | CDK 배포 시 (colima 사용 시 필요) |

## 프로젝트 구조

```
bedrock-claude-code-monitor/
├── webapp/                          # Next.js 웹 애플리케이션
│   ├── src/
│   │   ├── app/                     # App Router 페이지 + API Routes
│   │   │   ├── page.tsx             # Overview 대시보드 (메인 페이지)
│   │   │   ├── cost/page.tsx        # 비용 분석 페이지
│   │   │   ├── models/page.tsx      # 모델별 상세 통계 페이지
│   │   │   ├── trends/page.tsx      # 트렌드 및 예측 페이지
│   │   │   ├── pricing/page.tsx     # 가격 참조 페이지 (읽기 전용)
│   │   │   ├── layout.tsx           # 루트 레이아웃 (Sidebar 포함)
│   │   │   └── api/                 # REST API Routes
│   │   │       ├── metrics/
│   │   │       │   ├── realtime/route.ts   # CloudWatch 실시간 조회
│   │   │       │   └── history/route.ts    # DynamoDB 이력 조회
│   │   │       ├── cost/
│   │   │       │   ├── summary/route.ts    # 월별 누적 비용 요약
│   │   │       │   └── forecast/route.ts   # 월말 비용 예측
│   │   │       ├── models/route.ts         # 모델별 종합 통계
│   │   │       └── health/route.ts         # 헬스체크
│   │   ├── components/
│   │   │   ├── charts/              # ECharts 차트 컴포넌트 (15종)
│   │   │   │   ├── CacheHitGauge.tsx      # 캐시 히트율 게이지 차트
│   │   │   │   ├── CacheHitTrend.tsx      # 캐시 히트율 추이 Area 라인 (80% 목표선)
│   │   │   │   ├── CacheSavings.tsx       # 캐시 절감 비교 바 차트
│   │   │   │   ├── CacheTimeSeries.tsx    # 캐시 사용량 시계열
│   │   │   │   ├── CostEfficiencyScatter.tsx  # 비용 vs 레이턴시 버블 Scatter
│   │   │   │   ├── CostInterval.tsx       # 구간별 비용 바 차트
│   │   │   │   ├── CostPerInvocation.tsx  # 호출당 비용 추이 라인 차트
│   │   │   │   ├── CostSankey.tsx         # 비용 흐름 Sankey 다이어그램
│   │   │   │   ├── CostTreemap.tsx        # 비용 구성 Treemap
│   │   │   │   ├── DailyCostBar.tsx       # 일별 비용 Stacked Bar
│   │   │   │   ├── LatencyBoxplot.tsx     # 레이턴시 분포 Boxplot
│   │   │   │   ├── ModelDonut.tsx         # 모델별 비용 비율 도넛
│   │   │   │   ├── OutputInputRatio.tsx   # Input/Output 비용 비율 Stacked Bar
│   │   │   │   ├── RegionalSavings.tsx    # 리전별 vs 글로벌 비용 비교 (현재 페이지 미사용, 컴포넌트 보존)
│   │   │   │   ├── TokenTimeSeries.tsx    # 토큰 사용량 시계열
│   │   │   │   ├── UsageHeatmap.tsx       # 시간대별 사용 히트맵
│   │   │   │   └── index.ts              # 차트 컴포넌트 배럴 export
│   │   │   ├── dashboard/           # 대시보드 UI 컴포넌트
│   │   │   │   ├── KpiCard.tsx            # KPI 카드 단위 컴포넌트
│   │   │   │   ├── KpiGrid.tsx            # KPI 카드 그리드
│   │   │   │   ├── Sidebar.tsx            # 좌측 사이드바 네비게이션
│   │   │   │   └── TimeRangeSelector.tsx  # 시간 범위 선택기
│   │   │   └── providers.tsx        # TanStack Query + Theme Provider
│   │   ├── lib/
│   │   │   ├── aws/                 # AWS SDK 클라이언트 및 쿼리
│   │   │   │   ├── cloudwatch-client.ts   # CloudWatch 클라이언트 싱글톤
│   │   │   │   ├── cloudwatch-queries.ts  # CloudWatch 메트릭 조회 로직
│   │   │   │   └── metric-definitions.ts  # 메트릭/모델 정의, 쿼리 빌더
│   │   │   ├── db/                  # DynamoDB 데이터 레이어
│   │   │   │   ├── dynamodb-client.ts     # DynamoDB Document 클라이언트
│   │   │   │   ├── schema.ts              # 테이블명, PK/SK 상수
│   │   │   │   └── metrics-repository.ts  # 메트릭 CRUD 리포지토리
│   │   │   ├── constants/
│   │   │   │   └── pricing.ts       # 모델별 가격 정보 및 메타데이터
│   │   │   ├── types/
│   │   │   │   └── metrics.ts       # TypeScript 타입/인터페이스 정의
│   │   │   ├── utils/
│   │   │   │   ├── format.ts        # 숫자/통화/시간 포맷 유틸리티
│   │   │   │   └── calculate.ts     # 메트릭 집계 계산 유틸리티
│   │   │   ├── api.ts               # 프론트엔드 fetch 래퍼
│   │   │   └── utils.ts             # shadcn/ui cn() 유틸리티
│   │   └── styles/
│   │       └── globals.css          # Tailwind CSS + 테마 변수
│   ├── Dockerfile                   # 멀티스테이지 빌드 (builder + runner)
│   ├── package.json
│   ├── next.config.ts               # standalone 출력 모드 설정
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── postcss.config.mjs
├── cdk/                             # AWS CDK 인프라 코드
│   ├── bin/
│   │   └── app.ts                   # CDK 앱 엔트리포인트 (2개 스택 정의)
│   ├── lib/
│   │   ├── data-pipeline-stack.ts   # DynamoDB + Lambda + EventBridge
│   │   └── webapp-stack.ts          # VPC + ECS Fargate + ALB
│   ├── lambda/
│   │   └── aggregator/
│   │       ├── index.py             # 메트릭 수집 Lambda 핸들러
│   │       ├── backfill.py          # CloudWatch 이력 백필 스크립트
│   │       └── requirements.txt     # Python 의존성 (boto3 런타임 포함)
│   ├── cdk.json                     # CDK 설정
│   ├── package.json
│   └── tsconfig.json
├── docs/                            # 프로젝트 문서
│   ├── architecture.md
│   ├── api.md
│   ├── development.md
│   └── progress.md
└── README.md                        # 프로젝트 개요
```

## 로컬 개발

### 웹 애플리케이션 실행

```bash
# 1. 의존성 설치
cd webapp
npm install

# 2. 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

> **참고**: 로컬에서 실행 시 DynamoDB와 CloudWatch에 접근하기 위해 유효한 AWS 자격 증명이 필요합니다. `~/.aws/credentials` 파일이 올바르게 설정되어 있는지 확인하세요.

### 웹 애플리케이션 빌드

```bash
cd webapp
npm run build
```

Next.js `standalone` 모드로 빌드되어 `webapp/.next/standalone/` 디렉토리에 독립 실행 가능한 서버가 생성됩니다.

### Docker 로컬 빌드 및 실행

```bash
cd webapp

# Docker 이미지 빌드
docker build -t bedrock-dashboard .

# 로컬 실행 (AWS 자격증명 전달)
docker run -p 3000:3000 \
  -e TABLE_NAME=BedrockUsageMetrics \
  -e AWS_REGION=us-east-1 \
  -e AWS_ACCESS_KEY_ID=$(aws configure get aws_access_key_id) \
  -e AWS_SECRET_ACCESS_KEY=$(aws configure get aws_secret_access_key) \
  bedrock-dashboard
```

### Lambda 함수 로컬 테스트

Lambda Aggregator는 별도의 의존성이 없으므로(boto3는 Lambda 런타임에 포함) 로컬에서 직접 실행할 수 있습니다.

```bash
cd cdk/lambda/aggregator

# 환경 변수 설정
export TABLE_NAME=BedrockUsageMetrics

# Lambda 핸들러 직접 호출 (Python)
python3 -c "from index import handler; handler({}, None)"
```

### 백필 스크립트 실행

과거 CloudWatch 메트릭을 DynamoDB에 일괄 로드하려면 백필 스크립트를 사용합니다.

```bash
cd cdk/lambda/aggregator

# 백필 실행 (기존 데이터를 삭제하고 재생성)
python3 backfill.py
```

> **주의**: 백필 스크립트는 기존 `METRIC#hourly`, `METRIC#daily`, `CUMULATIVE` 레코드를 모두 삭제한 후 재생성합니다. 운영 환경에서 실행 시 주의가 필요합니다.

## CDK 배포

### 사전 요구사항

- Docker가 실행 중이어야 합니다 (ECS 컨테이너 이미지 빌드에 필요).
- colima 사용 시 `DOCKER_HOST` 환경 변수를 설정해야 합니다.

```bash
# colima 사용 시
brew install colima
colima start
export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock
```

### 배포 단계

```bash
# 1. CDK 의존성 설치
cd cdk
npm install

# 2. CDK 부트스트랩 (최초 1회, 계정/리전별)
cdk bootstrap aws://ACCOUNT_ID/us-east-1

# 3. 변경사항 확인 (diff)
cdk diff

# 4. 전체 스택 배포
cdk deploy --all --require-approval never

# colima 사용 시
DOCKER_HOST=unix://$HOME/.colima/default/docker.sock cdk deploy --all --require-approval never
```

배포가 완료되면 CloudFront URL이 출력됩니다:
```
Outputs:
  WebAppStack.DashboardUrl = https://xxxx.cloudfront.net
  WebAppStack.DistributionId = E1XXXXXXXXXX
```

### 개별 스택 배포

```bash
# DataPipelineStack만 배포 (DynamoDB + Lambda)
cdk deploy DataPipelineStack

# WebAppStack만 배포 (VPC + ECS + ALB)
cdk deploy WebAppStack
```

### 스택 삭제

```bash
# 전체 스택 삭제
cdk destroy --all

# 개별 스택 삭제
cdk destroy WebAppStack
```

> **참고**: `DataPipelineStack`의 DynamoDB 테이블은 `RemovalPolicy.RETAIN`으로 설정되어 있으므로, 스택 삭제 시에도 테이블은 보존됩니다. 수동 삭제가 필요합니다.

## 코드 컨벤션

### TypeScript

- 엄격 모드(`strict: true`) 사용
- 경로 별칭(Path Alias): `@/`는 `webapp/src/`를 가리킵니다
- 모든 API 응답에 TypeScript 인터페이스를 정의합니다 (`src/lib/types/metrics.ts`)
- 서버 컴포넌트와 클라이언트 컴포넌트를 명확히 구분합니다 (`'use client'` 지시문)

### 파일 네이밍

| 유형 | 규칙 | 예시 |
|------|------|------|
| React 컴포넌트 | PascalCase | `KpiGrid.tsx`, `CostSankey.tsx` |
| API Route | Next.js 규칙 (`route.ts`) | `api/metrics/history/route.ts` |
| 유틸리티 | camelCase | `calculate.ts`, `format.ts` |
| 타입 정의 | camelCase | `metrics.ts` |
| CDK 스택 | kebab-case | `data-pipeline-stack.ts` |
| Lambda 핸들러 | snake_case (Python) | `index.py` |

### 데이터 계층 구조

```
API Route (route.ts)
  └── Repository (metrics-repository.ts)
        └── DynamoDB Client (dynamodb-client.ts)
              └── AWS SDK (@aws-sdk/lib-dynamodb)
```

```
API Route (route.ts)
  └── CloudWatch Queries (cloudwatch-queries.ts)
        └── Metric Definitions (metric-definitions.ts)
              └── CloudWatch Client (cloudwatch-client.ts)
                    └── AWS SDK (@aws-sdk/client-cloudwatch)
```

### 차트 컴포넌트 패턴

모든 차트 컴포넌트는 다음 패턴을 따릅니다:

```typescript
'use client';

import ReactECharts from 'echarts-for-react';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';

interface Props {
  data: MetricDataPoint[];  // 또는 특화된 props (예: ModelStats[])
}

export function ChartComponent({ data }: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const option = useMemo(() => {
    // ECharts 옵션 생성
    return { /* ... */ };
  }, [data, isDark]);

  if (!option) {
    return <div>No data available</div>;
  }

  return (
    <ReactECharts
      option={option}
      theme={isDark ? 'dark' : undefined}
      style={{ width: '100%', height: '400px' }}
      opts={{ renderer: 'svg' }}
    />
  );
}
```

모델 패밀리(Opus/Sonnet/Haiku) 색상은 `FAMILY_COLORS` 상수를 사용합니다:

```typescript
import { MODEL_PRICING, FAMILY_COLORS } from '@/lib/constants/pricing';

// FAMILY_COLORS = { opus: '#8b5cf6', sonnet: '#3b82f6', haiku: '#10b981' }
```

차트 유형별 참고 컴포넌트:

| 차트 유형 | 참고 컴포넌트 | ECharts 시리즈 유형 |
|-----------|-------------|-----------------|
| 게이지(Gauge) | `CacheHitGauge.tsx` | `gauge` |
| 버블 스캐터(Scatter) | `CostEfficiencyScatter.tsx` | `scatter` |
| 영역 라인(Area) | `CacheHitTrend.tsx` | `line` + `areaStyle` |
| 호리즌탈 바(Horizontal Bar) | `OutputInputRatio.tsx`, `RegionalSavings.tsx` | `bar` (yAxis: category) |
| 패밀리별 라인(Multi-Line) | `CostPerInvocation.tsx` | `line` (패밀리별 시리즈) |

## 린트 및 타입 체크

```bash
cd webapp

# ESLint 실행
npm run lint

# TypeScript 타입 체크
npx tsc --noEmit
```

## 모델 추가 방법

새로운 Claude 모델을 모니터링에 추가하려면 다음 3곳을 수정합니다:

### 1. Lambda Aggregator 수정

파일: `cdk/lambda/aggregator/index.py`

```python
MODEL_IDS = [
    # 기존 모델들...
    "global.anthropic.claude-new-model-v1",  # 추가
]
```

### 2. 웹앱 메트릭 정의 수정

파일: `webapp/src/lib/aws/metric-definitions.ts`

```typescript
export const MODEL_IDS = [
  // 기존 모델들...
  'global.anthropic.claude-new-model-v1',  // 추가
] as const;
```

### 3. 웹앱 가격 정보 수정

파일: `webapp/src/lib/constants/pricing.ts`

```typescript
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // 기존 모델들...
  'global.anthropic.claude-new-model-v1': {
    name: 'Claude New Model',
    shortName: 'New',
    family: 'sonnet',  // 'opus' | 'sonnet' | 'haiku'
    input: 3,
    output: 15,
    cacheWrite: 3.75,
    cacheRead: 0.30,
  },
};
```

수정 후 Lambda를 재배포하고(`cdk deploy DataPipelineStack`), 웹앱을 재배포합니다(`cdk deploy WebAppStack`).

## 트러블슈팅

### CloudWatch 메트릭이 수집되지 않을 때

1. AWS/Bedrock 네임스페이스에 해당 모델의 메트릭이 존재하는지 확인합니다:
   ```bash
   aws cloudwatch list-metrics --namespace AWS/Bedrock --metric-name Invocations
   ```
2. Lambda 함수의 CloudWatch Logs를 확인합니다:
   ```bash
   aws logs tail /aws/lambda/BedrockMetricsAggregator --follow
   ```
3. 모델 ID가 정확한지 확인합니다 (대소문자, 버전 번호 포함).

### DynamoDB 데이터가 없을 때

1. 테이블이 존재하는지 확인합니다:
   ```bash
   aws dynamodb describe-table --table-name BedrockUsageMetrics
   ```
2. Lambda 함수의 IAM 권한을 확인합니다 (`PutItem`, `UpdateItem` 허용 여부).
3. 백필 스크립트를 실행하여 과거 데이터를 로드합니다.

### ECS 태스크가 시작되지 않을 때

1. ECS 서비스 이벤트를 확인합니다:
   ```bash
   aws ecs describe-services --cluster bedrock-dashboard-cluster --services BedrockDashboardService
   ```
2. CloudWatch Logs에서 컨테이너 로그를 확인합니다 (`bedrock-dashboard` 로그 그룹).
3. 태스크 역할(Task Role)의 IAM 권한을 확인합니다.
4. NAT Gateway가 정상인지 확인합니다 (Private 서브넷에서 외부 접근 필요).

### Docker 빌드 실패 시 (colima)

```bash
# colima가 실행 중인지 확인
colima status

# colima 재시작
colima stop && colima start

# DOCKER_HOST 설정 확인
echo $DOCKER_HOST
# 예상 출력: unix:///Users/<username>/.colima/default/docker.sock
```
