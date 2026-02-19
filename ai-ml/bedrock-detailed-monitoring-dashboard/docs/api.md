# API 명세

## Base URL

```
Production: https://{CLOUDFRONT_DOMAIN}
로컬 개발: http://localhost:3000
```

> **참고**: 프로덕션 환경에서는 CloudFront Distribution 도메인(`xxxx.cloudfront.net`)을 통해 접근합니다. Internal ALB는 직접 접근이 불가능합니다.

## 인증

현재 API에 별도 인증이 설정되어 있지 않습니다. 프로덕션 환경에서는 ALB에 Cognito User Pool 또는 OIDC 인증을 추가하는 것을 권장합니다.

## 공통 사항

- 모든 응답은 `application/json` 형식입니다.
- 시간은 ISO 8601 형식(`YYYY-MM-DDTHH:MM:SSZ`)을 사용합니다.
- 에러 응답에는 `error` 필드가 포함됩니다.
- 모든 비용(cost) 관련 값의 단위는 USD입니다.
- 토큰 관련 값은 개별 토큰 수(정수)입니다.
- 레이턴시(latency) 값의 단위는 밀리초(ms)입니다.

## 엔드포인트

---

### 메트릭(Metrics)

#### GET /api/metrics/realtime

CloudWatch에서 실시간 메트릭을 직접 조회합니다. 최신 데이터를 빠르게 확인할 때 사용합니다.

**요청 파라미터(Query String)**

| 파라미터 | 타입 | 필수 | 설명 | 기본값 |
|----------|------|------|------|--------|
| `range` | string | N | 시간 범위. `1h`, `6h`, `24h`, `7d`, `30d` 중 하나 | `1h` |

**요청 예시**

```bash
curl -X GET "https://{CLOUDFRONT_DOMAIN}/api/metrics/realtime?range=6h"
```

**응답 (200)**

```json
{
  "data": [
    {
      "timestamp": "2026-02-13T10:30:00.000Z",
      "invocations": {
        "global.anthropic.claude-opus-4-6-v1": 5
      },
      "inputTokens": {
        "global.anthropic.claude-opus-4-6-v1": 15000
      },
      "outputTokens": {
        "global.anthropic.claude-opus-4-6-v1": 3000
      },
      "cacheReadTokens": {
        "global.anthropic.claude-opus-4-6-v1": 8000
      },
      "cacheWriteTokens": {
        "global.anthropic.claude-opus-4-6-v1": 2000
      },
      "cost": {
        "global.anthropic.claude-opus-4-6-v1": 0.000450
      },
      "cacheSavings": {
        "global.anthropic.claude-opus-4-6-v1": 0.000036
      },
      "latencyAvg": {
        "global.anthropic.claude-opus-4-6-v1": 1250.5
      }
    }
  ],
  "timeRange": "6h"
}
```

**에러 코드**

| 코드 | 설명 |
|------|------|
| 400 | 유효하지 않은 `range` 값 |
| 500 | CloudWatch API 호출 실패 |

---

#### GET /api/metrics/history

DynamoDB에 저장된 이력 메트릭을 조회합니다. Lambda Aggregator가 집계한 데이터를 반환합니다.

**요청 파라미터(Query String)**

| 파라미터 | 타입 | 필수 | 설명 | 기본값 |
|----------|------|------|------|--------|
| `range` | string | N | 시간 범위. `1h`, `6h`, `24h`, `7d`, `30d`, `custom` 중 하나 | `1h` |
| `granularity` | string | N | 데이터 해상도. `minute`, `hourly`, `daily` 중 하나. 미지정 시 range에 따라 자동 결정 | 자동 |
| `start` | string | 조건부 | 커스텀 범위 시작 시간 (ISO 8601). `range=custom`일 때 필수 | - |
| `end` | string | 조건부 | 커스텀 범위 종료 시간 (ISO 8601). `range=custom`일 때 필수 | - |

**자동 Granularity 매핑**

| range | 자동 granularity |
|-------|-----------------|
| `1h` | minute |
| `6h` | minute |
| `24h` | hourly |
| `7d` | daily |
| `30d` | daily |
| `custom` (6시간 이하) | minute |
| `custom` (3일 이하) | hourly |
| `custom` (3일 초과) | daily |

**요청 예시**

```bash
# 프리셋 범위 사용
curl -X GET "https://{CLOUDFRONT_DOMAIN}/api/metrics/history?range=24h"

# 커스텀 범위 사용
curl -X GET "https://{CLOUDFRONT_DOMAIN}/api/metrics/history?range=custom&start=2026-02-10&end=2026-02-13"

# Granularity 직접 지정
curl -X GET "https://{CLOUDFRONT_DOMAIN}/api/metrics/history?range=7d&granularity=hourly"
```

**응답 (200)**

```json
{
  "data": [
    {
      "timestamp": "2026-02-13T10:00:00Z",
      "invocations": { "global.anthropic.claude-opus-4-6-v1": 120 },
      "inputTokens": { "global.anthropic.claude-opus-4-6-v1": 350000 },
      "outputTokens": { "global.anthropic.claude-opus-4-6-v1": 75000 },
      "cacheReadTokens": { "global.anthropic.claude-opus-4-6-v1": 200000 },
      "cacheWriteTokens": { "global.anthropic.claude-opus-4-6-v1": 50000 },
      "cost": { "global.anthropic.claude-opus-4-6-v1": 2.850000 },
      "cacheSavings": { "global.anthropic.claude-opus-4-6-v1": 0.900000 },
      "latencyAvg": { "global.anthropic.claude-opus-4-6-v1": 1100.25 }
    }
  ],
  "granularity": "hourly",
  "timeRange": "24h"
}
```

**에러 코드**

| 코드 | 설명 |
|------|------|
| 400 | 유효하지 않은 `range`, `granularity`, 또는 커스텀 범위 파라미터 |
| 500 | DynamoDB 쿼리 실패 |

---

### 비용(Cost)

#### GET /api/cost/summary

월별 누적 비용 요약을 조회합니다. DynamoDB의 `CUMULATIVE` 레코드를 조회합니다.

**요청 파라미터(Query String)**

| 파라미터 | 타입 | 필수 | 설명 | 기본값 |
|----------|------|------|------|--------|
| `month` | string | N | 조회할 월 (`YYYY-MM` 형식) | 현재 월 |

**요청 예시**

```bash
curl -X GET "https://{CLOUDFRONT_DOMAIN}/api/cost/summary?month=2026-02"
```

**응답 (200)**

```json
{
  "month": "2026-02",
  "totalCost": 125.50,
  "totalTokens": 50000000,
  "byModel": {
    "global.anthropic.claude-opus-4-6-v1": {
      "cost": 80.25,
      "inputTokens": 0,
      "outputTokens": 0,
      "cacheReadTokens": 0,
      "cacheWriteTokens": 0,
      "invocations": 5000
    },
    "global.anthropic.claude-sonnet-4-5-20250929-v1:0": {
      "cost": 45.25,
      "inputTokens": 0,
      "outputTokens": 0,
      "cacheReadTokens": 0,
      "cacheWriteTokens": 0,
      "invocations": 3200
    }
  },
  "lastUpdated": "2026-02-13T10:30:00Z"
}
```

**에러 코드**

| 코드 | 설명 |
|------|------|
| 400 | 유효하지 않은 `month` 형식 (YYYY-MM이 아닌 경우) |
| 500 | DynamoDB 조회 실패 |

> **참고**: `byModel` 내 `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`는 현재 CUMULATIVE 레코드에 저장되지 않으므로 항상 `0`입니다. 토큰 상세 내역은 `/api/metrics/history`를 사용하세요.

---

#### GET /api/cost/forecast

월말 비용 예측을 반환합니다. 현재까지의 일평균 비용을 기반으로 월 전체 비용을 추정하고, 최근 7일 vs 이전 7일 비용을 비교하여 트렌드를 판단합니다.

**요청 파라미터**: 없음

**요청 예시**

```bash
curl -X GET "https://{CLOUDFRONT_DOMAIN}/api/cost/forecast"
```

**응답 (200)**

```json
{
  "currentCost": 52.30,
  "projectedMonthEnd": 125.52,
  "daysElapsed": 13,
  "daysInMonth": 28,
  "dailyAverage": 4.02,
  "trend": "stable"
}
```

**필드 설명**

| 필드 | 타입 | 설명 |
|------|------|------|
| `currentCost` | number | 당월 현재까지 누적 비용 (USD) |
| `projectedMonthEnd` | number | 월말 예상 비용 (`일평균 * 월 총 일수`) |
| `daysElapsed` | number | 당월 경과 일수 |
| `daysInMonth` | number | 당월 총 일수 |
| `dailyAverage` | number | 일평균 비용 (USD) |
| `trend` | string | `increasing`, `stable`, `decreasing` 중 하나. 최근 7일 vs 이전 7일 비교 기준 (10% 이상 변동 시 증가/감소) |

**에러 코드**

| 코드 | 설명 |
|------|------|
| 500 | DynamoDB 조회 또는 계산 실패 |

---

### 모델(Models)

#### GET /api/models

지정 기간 내 모델별 종합 통계를 반환합니다. 비용, 토큰, 호출 수, 레이턴시, 캐시 히트율을 포함합니다.

**요청 파라미터(Query String)**

| 파라미터 | 타입 | 필수 | 설명 | 기본값 |
|----------|------|------|------|--------|
| `range` | string | N | 시간 범위. `1h`, `6h`, `24h`, `7d`, `30d`, `custom` 중 하나 | `24h` |
| `start` | string | 조건부 | 커스텀 범위 시작 시간. `range=custom`일 때 필수 | - |
| `end` | string | 조건부 | 커스텀 범위 종료 시간. `range=custom`일 때 필수 | - |

**요청 예시**

```bash
curl -X GET "https://{CLOUDFRONT_DOMAIN}/api/models?range=7d"
```

**응답 (200)**

```json
{
  "models": [
    {
      "modelId": "global.anthropic.claude-opus-4-6-v1",
      "totalCost": 45.123456,
      "totalTokens": 12500000,
      "avgLatency": 1250.50,
      "invocations": 3200,
      "cacheHitRate": 78.50
    },
    {
      "modelId": "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
      "totalCost": 22.654321,
      "totalTokens": 8000000,
      "avgLatency": 850.25,
      "invocations": 1500,
      "cacheHitRate": 65.30
    }
  ],
  "timeRange": "7d"
}
```

**필드 설명**

| 필드 | 타입 | 설명 |
|------|------|------|
| `modelId` | string | 모델 식별자 |
| `totalCost` | number | 해당 기간 총 비용 (USD) |
| `totalTokens` | number | 총 토큰 수 (입력 + 출력 + 캐시읽기 + 캐시쓰기) |
| `avgLatency` | number | 평균 레이턴시 (ms) |
| `invocations` | number | 총 호출 횟수 |
| `cacheHitRate` | number | 캐시 히트율 (%) = `cacheRead / (cacheRead + cacheWrite) * 100` |

결과는 `totalCost` 내림차순으로 정렬됩니다.

**에러 코드**

| 코드 | 설명 |
|------|------|
| 400 | 유효하지 않은 `range` 또는 커스텀 범위 파라미터 |
| 500 | DynamoDB 쿼리 실패 |

---

### 헬스체크(Health)

#### GET /api/health

애플리케이션 상태를 확인합니다. ALB 헬스체크에 사용됩니다.

**요청 파라미터**: 없음

**요청 예시**

```bash
curl -X GET "https://{CLOUDFRONT_DOMAIN}/api/health"
```

**응답 (200)**

```json
{
  "status": "healthy",
  "timestamp": "2026-02-13T10:30:00.000Z",
  "version": "0.1.0"
}
```

---

## 데이터 타입 정의

### MetricDataPoint

모든 메트릭 관련 API에서 사용되는 기본 데이터 포인트 구조입니다. 각 필드는 `Record<string, number>` 타입으로, 모델 ID를 키(key)로 사용합니다.

```typescript
interface MetricDataPoint {
  timestamp: string;                        // ISO 8601 형식
  invocations: Record<string, number>;      // 모델별 호출 횟수
  inputTokens: Record<string, number>;      // 모델별 입력 토큰 수
  outputTokens: Record<string, number>;     // 모델별 출력 토큰 수
  cacheReadTokens: Record<string, number>;  // 모델별 캐시 읽기 토큰 수
  cacheWriteTokens: Record<string, number>; // 모델별 캐시 쓰기 토큰 수
  cost: Record<string, number>;             // 모델별 비용 (USD)
  cacheSavings: Record<string, number>;     // 모델별 캐시 절감액 (USD)
  latencyAvg: Record<string, number>;       // 모델별 평균 레이턴시 (ms)
}
```

### CostSummary

월별 누적 비용 요약 구조입니다.

```typescript
interface CostSummary {
  month: string;                              // YYYY-MM 형식
  totalCost: number;                          // 총 비용 (USD)
  totalTokens: number;                        // 총 토큰 수
  byModel: Record<string, ModelCostDetail>;   // 모델별 상세
  lastUpdated: string;                        // 마지막 업데이트 시간 (ISO 8601)
}

interface ModelCostDetail {
  cost: number;             // 모델 비용 (USD)
  inputTokens: number;      // 입력 토큰 수
  outputTokens: number;     // 출력 토큰 수
  cacheReadTokens: number;  // 캐시 읽기 토큰 수
  cacheWriteTokens: number; // 캐시 쓰기 토큰 수
  invocations: number;      // 호출 횟수
}
```

### CostForecast

월말 비용 예측 구조입니다.

```typescript
interface CostForecast {
  currentCost: number;        // 당월 누적 비용 (USD)
  projectedMonthEnd: number;  // 월말 예상 비용 (USD)
  daysElapsed: number;        // 경과 일수
  daysInMonth: number;        // 월 총 일수
  dailyAverage: number;       // 일평균 비용 (USD)
  trend: 'increasing' | 'stable' | 'decreasing';
}
```

## 모니터링 대상 모델 ID

| 모델 ID | 표시 이름 |
|---------|----------|
| `global.anthropic.claude-opus-4-6-v1` | Claude Opus 4.6 |
| `global.anthropic.claude-opus-4-5-20251101-v1:0` | Claude Opus 4.5 |
| `us.anthropic.claude-opus-4-5-20251101-v1:0` | Claude Opus 4.5 (US) |
| `global.anthropic.claude-sonnet-4-6` | Claude Sonnet 4.6 |
| `global.anthropic.claude-sonnet-4-5-20250929-v1:0` | Claude Sonnet 4.5 |
| `global.anthropic.claude-haiku-4-5-20251001-v1:0` | Claude Haiku 4.5 |
| `us.anthropic.claude-haiku-4-5-20251001-v1:0` | Claude Haiku 4.5 (US) |
| `us.anthropic.claude-3-5-haiku-20241022-v1:0` | Claude Haiku 3.5 (US) |
