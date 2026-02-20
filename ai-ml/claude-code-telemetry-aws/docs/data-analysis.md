# Claude Code Telemetry - 데이터 스키마/파이프라인 분석

## 1. 데이터 파이프라인 아키텍처

```
Claude Code (OTLP SDK)
    |
    v
ADOT Collector (awscloudwatchlogs exporter)
    |
    v
CloudWatch Logs (/claude-code/telemetry-events, 1일 보존)
    |
    v [CW Logs Subscription Filter]
Kinesis Data Firehose (events-stream)
    |
    v [Lambda 변환: firehose-transformer]
S3 (Parquet, SNAPPY 압축, 시간별 파티셔닝)
    |
    v [Glue Data Catalog]
Athena (SQL 쿼리) --> Grafana (대시보드)
```

**Lambda 변환기 처리 흐름:**
1. Base64 디코딩 -> gzip 압축 해제 -> JSON 파싱 (CW Logs 엔벨로프)
2. `CONTROL_MESSAGE` 타입 레코드 Drop
3. 각 logEvent에서 OTLP 로그 레코드 추출
4. Body, Attributes, Resource 3개 속성 소스를 병합 (우선순위: resource < attributes < body)
5. Glue 스키마에 매칭되는 플랫 JSON 레코드 생성
6. Newline-delimited JSON으로 인코딩 후 Firehose에 반환

**파티셔닝 구조:**
```
s3://bucket/year=YYYY/month=MM/day=DD/hour=HH/
```
- Firehose timestamp 기반 자동 파티셔닝
- 매시간 EventBridge -> Lambda로 `MSCK REPAIR TABLE` 실행하여 파티션 등록
- `projection.enabled = false` (가상 파티셔닝 비활성화)

---

## 2. Glue 테이블 스키마 전체 분석 (34개 컬럼)

### 2.1 공통 필드 (Common Fields) - 7개

| # | 컬럼명 | 타입 | 설명 | Lambda 매핑 소스 키 |
|---|--------|------|------|---------------------|
| 1 | `event_name` | string | 이벤트 타입 식별자 | Body 문자열 (claude_code.*) 또는 `event_name`, `event.name`, `name` |
| 2 | `session_id` | string | 세션 고유 식별자 | `session_id`, `session.id` |
| 3 | `timestamp` | timestamp | 이벤트 타임스탬프 (UTC) | `timestamp`, `Timestamp` 또는 CW Logs 이벤트 타임스탬프 (fallback) |
| 4 | `organization_id` | string | 조직 식별자 | `organization_id`, `organization.id` |
| 5 | `user_id` | string | 사용자 식별자 (해시됨) | `user.id`, `user_id`, `user.account.uuid`, `user_account_uuid` |
| 6 | `user_name` | string | 사용자 이름 | `user.name`, `user_name` |
| 7 | `terminal_type` | string | 터미널 타입 | `terminal_type`, `terminal.type` |

### 2.2 리소스 속성 (Resource Attributes) - 5개

| # | 컬럼명 | 타입 | 설명 | Lambda 매핑 소스 키 |
|---|--------|------|------|---------------------|
| 8 | `service_name` | string | 서비스 이름 | `service.name`, `service_name` |
| 9 | `service_version` | string | 서비스 버전 | `service.version`, `service_version` |
| 10 | `os_type` | string | 운영체제 타입 | `os.type`, `os_type` |
| 11 | `os_version` | string | 운영체제 버전 | `os.version`, `os_version` |
| 12 | `host_arch` | string | 호스트 아키텍처 | `host.arch`, `host_arch` |

### 2.3 커스텀 리소스 속성 (Custom Resource Attributes) - 3개

| # | 컬럼명 | 타입 | 설명 | Lambda 매핑 소스 키 |
|---|--------|------|------|---------------------|
| 13 | `department` | string | 부서명 | `department` |
| 14 | `team_id` | string | 팀 식별자 | `team_id`, `team.id` |
| 15 | `cost_center` | string | 비용 센터 코드 | `cost_center`, `cost.center` |

### 2.4 이벤트별 전용 필드 (Event-specific Fields) - 15개

| # | 컬럼명 | 타입 | 설명 | Lambda 매핑 소스 키 |
|---|--------|------|------|---------------------|
| 16 | `prompt_length` | int | 프롬프트 문자 길이 | `prompt_length`, `prompt.length` |
| 17 | `prompt_id` | string | 프롬프트 고유 식별자 | `prompt.id`, `prompt_id` |
| 18 | `tool_name` | string | 도구 이름 | `tool_name`, `tool.name` |
| 19 | `success` | boolean | 도구 실행 성공 여부 | `success` |
| 20 | `duration_ms` | double | 실행 시간 (밀리초) | `duration_ms`, `duration.ms` |
| 21 | `error` | string | 에러 메시지 | `error`, `error.message` |
| 22 | `decision` | string | 도구 결정 (accept/reject) | `decision` |
| 23 | `source` | string | 결정 소스 | `source`, `decision_source` |
| 24 | `tool_parameters` | string | 도구 파라미터 (JSON 문자열) | `tool_parameters`, `tool.parameters` |
| 25 | `tool_result_size_bytes` | int | 도구 결과 크기 (바이트) | `tool_result_size_bytes` |
| 26 | `model` | string | 모델 이름 | `model`, `model.name` |
| 27 | `speed` | string | API 응답 속도 모드 | `speed` |
| 28 | `cost_usd` | double | API 호출 비용 (USD) | `cost_usd`, `cost.usd` |
| 29 | `input_tokens` | bigint | 입력 토큰 수 | `input_tokens`, `input.tokens` |
| 30 | `output_tokens` | bigint | 출력 토큰 수 | `output_tokens`, `output.tokens` |
| 31 | `cache_read_tokens` | bigint | 캐시 읽기 토큰 수 | `cache_read_tokens`, `cache.read.tokens` |
| 32 | `cache_creation_tokens` | bigint | 캐시 생성 토큰 수 | `cache_creation_tokens`, `cache.creation.tokens` |
| 33 | `status_code` | int | HTTP 상태 코드 | `status_code`, `http.status_code` |
| 34 | `attempt` | int | 재시도 횟수 | `attempt` |

### 2.5 파티션 키 (Partition Keys) - 4개

| # | 컬럼명 | 타입 | 설명 |
|---|--------|------|------|
| P1 | `year` | string | 연도 (YYYY) |
| P2 | `month` | string | 월 (MM) |
| P3 | `day` | string | 일 (DD) |
| P4 | `hour` | string | 시 (HH, UTC) |

---

## 3. event_name별 사용 가능 컬럼 매트릭스

아래 표는 각 이벤트 타입에서 데이터가 실제로 채워질 것으로 예상되는 필드를 나타냄.

| 컬럼 | api_request | api_error | tool_result | tool_decision | user_prompt |
|------|:-----------:|:---------:|:-----------:|:-------------:|:-----------:|
| **공통 필드** | | | | | |
| event_name | O | O | O | O | O |
| session_id | O | O | O | O | O |
| timestamp | O | O | O | O | O |
| organization_id | O | O | O | O | O |
| user_id | O | O | O | O | O |
| user_name | O | O | O | O | O |
| terminal_type | O | O | O | O | O |
| **리소스 속성** | | | | | |
| service_name | O | O | O | O | O |
| service_version | O | O | O | O | O |
| os_type | O | O | O | O | O |
| os_version | O | O | O | O | O |
| host_arch | O | O | O | O | O |
| **커스텀 리소스 속성** | | | | | |
| department | O | O | O | O | O |
| team_id | O | O | O | O | O |
| cost_center | O | O | O | O | O |
| **이벤트별 전용 필드** | | | | | |
| prompt_length | - | - | - | - | O |
| prompt_id | - | - | - | - | O |
| tool_name | - | - | O | O | - |
| success | - | - | O | - | - |
| duration_ms | O | O | O | - | - |
| error | - | O | O (실패시) | - | - |
| decision | - | - | O | O | - |
| source | - | - | O | O | - |
| tool_parameters | - | - | O | - | - |
| tool_result_size_bytes | - | - | O | - | - |
| model | O | O | - | - | - |
| speed | O | - | - | - | - |
| cost_usd | O | - | - | - | - |
| input_tokens | O | - | - | - | - |
| output_tokens | O | - | - | - | - |
| cache_read_tokens | O | - | - | - | - |
| cache_creation_tokens | O | - | - | - | - |
| status_code | - | O | - | - | - |
| attempt | - | O | - | - | - |

**범례:** O = 값이 채워짐, - = NULL (해당 이벤트에서 사용하지 않음)

**참고:** 리소스 속성(service_name, os_type 등)과 커스텀 리소스 속성(department, team_id, cost_center)은 OTel 리소스에서 오므로 모든 이벤트 타입에 공통으로 포함됨. 다만, 커스텀 속성은 클라이언트 설정에 따라 NULL일 수 있음.

---

## 4. 현재 대시보드 필드 사용 현황

### 4.1 대시보드별 사용 필드

| 대시보드 | 사용 필드 |
|----------|-----------|
| **Overview** (10 패널) | `event_name`, `session_id`, `timestamp`, `user_id`, `user_name`, `team_id`, `cost_usd`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `year`, `month`, `day`, `hour` |
| **Cost** (10 패널) | `event_name`, `session_id`, `timestamp`, `user_id`, `user_name`, `team_id`, `model`, `cost_usd`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `year`, `month`, `day`, `hour` |
| **Usage** (10 패널) | `event_name`, `session_id`, `timestamp`, `user_id`, `user_name`, `team_id`, `model`, `terminal_type`, `os_type`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `year`, `month`, `day`, `hour` |
| **Tool Analytics** (11 패널) | `event_name`, `session_id`, `timestamp`, `user_id`, `user_name`, `team_id`, `tool_name`, `success`, `duration_ms`, `error`, `decision`, `year`, `month`, `day`, `hour` |
| **API Performance** (9 패널) | `event_name`, `session_id`, `timestamp`, `user_id`, `user_name`, `team_id`, `model`, `duration_ms`, `status_code`, `error`, `attempt`, `cost_usd`, `input_tokens`, `output_tokens`, `year`, `month`, `day`, `hour` |

### 4.2 사용/미사용 필드 분류

**현재 사용 중인 필드 (22/34+4):**

| 카테고리 | 필드 | 사용 대시보드 |
|----------|------|--------------|
| 공통 | `event_name` | 전체 |
| 공통 | `session_id` | 전체 |
| 공통 | `timestamp` | 전체 |
| 공통 | `user_id` | Overview, Cost, Usage, Tools |
| 공통 | `user_name` | Overview, Cost, Usage, Tools, API |
| 공통 | `terminal_type` | Usage |
| 리소스 | `os_type` | Usage |
| 커스텀 | `team_id` | 전체 (필터 변수) |
| 이벤트 | `tool_name` | Tools |
| 이벤트 | `success` | Tools |
| 이벤트 | `duration_ms` | Tools, API |
| 이벤트 | `error` | Tools, API |
| 이벤트 | `decision` | Tools |
| 이벤트 | `model` | Cost, Usage, API |
| 이벤트 | `cost_usd` | Overview, Cost, API |
| 이벤트 | `input_tokens` | Overview, Cost, Usage, API |
| 이벤트 | `output_tokens` | Overview, Cost, Usage, API |
| 이벤트 | `cache_read_tokens` | Overview, Cost, Usage |
| 이벤트 | `cache_creation_tokens` | Overview, Usage |
| 이벤트 | `status_code` | API |
| 이벤트 | `attempt` | API |
| 파티션 | `year`, `month`, `day`, `hour` | 전체 (파티션 프루닝) |

**미사용 필드 (12/34):**

| # | 컬럼명 | 타입 | 활용 가능성 | 미사용 이유 추정 |
|---|--------|------|------------|-----------------|
| 1 | `organization_id` | string | **높음** | 멀티 조직 환경에서 조직별 분석 가능 |
| 2 | `service_name` | string | 중간 | 현재 단일 서비스(claude-code)로 고정값일 가능성 |
| 3 | `service_version` | string | **높음** | 버전별 사용 패턴/비용 비교 분석 가능 |
| 4 | `os_version` | string | 중간 | os_type만 사용 중, 세부 버전 분석 추가 가능 |
| 5 | `host_arch` | string | 중간 | ARM vs x86 아키텍처별 사용량 분석 가능 |
| 6 | `department` | string | **높음** | 부서별 비용 배분 및 사용량 분석 가능 |
| 7 | `cost_center` | string | **높음** | 비용 센터별 차지백 분석 가능 |
| 8 | `prompt_length` | int | **높음** | 프롬프트 길이와 비용/토큰 상관관계 분석 가능 |
| 9 | `prompt_id` | string | 중간 | 개별 프롬프트 추적, 세션 내 프롬프트 수 집계 가능 |
| 10 | `source` | string | **높음** | tool_decision의 결정 소스 분석 (자동/수동 승인 등) |
| 11 | `tool_parameters` | string | 낮음 | JSON 문자열이라 분석 어려움, 특정 패턴 추출 시 유용 |
| 12 | `tool_result_size_bytes` | int | **높음** | 도구 결과 크기 분석, 대용량 결과 모니터링 가능 |
| 13 | `speed` | string | **높음** | API 속도 모드별 비용/성능 비교 가능 |

---

## 5. OTel 리소스 속성 추가 활용 제안

### 5.1 현재 수집 중이지만 미활용 데이터 포인트

#### (A) 고가치 활용 제안

| 필드 | 제안 활용 방식 | 기대 효과 |
|------|---------------|-----------|
| `organization_id` | 조직별 비용/사용량 대시보드 필터 추가 | 멀티테넌트 환경 비용 추적 |
| `service_version` | 버전별 비용 추이, 버전 업그레이드 영향 분석 | 버전 롤아웃 모니터링 |
| `department` | 부서별 비용 대시보드 패널 | 비용 배분 및 예산 관리 |
| `cost_center` | 비용 센터별 차지백 리포트 | FinOps 요구사항 충족 |
| `prompt_length` | 프롬프트 길이 분포, 길이 vs 비용 상관관계 | 사용 패턴 최적화 인사이트 |
| `tool_result_size_bytes` | 도구 결과 크기 분포, 이상 탐지 | 성능 병목 식별 |
| `speed` | 속도 모드별 비용/레이턴시 비교 | 속도 모드 최적화 의사결정 |
| `source` | 도구 결정의 자동/수동 비율 분석 | 자동화 수준 모니터링 |

#### (B) 중간 가치 활용 제안

| 필드 | 제안 활용 방식 | 기대 효과 |
|------|---------------|-----------|
| `os_version` | OS 버전별 세분화 분석 | 호환성 이슈 조기 발견 |
| `host_arch` | ARM vs x86 사용량 분포 | 인프라 최적화 |
| `prompt_id` | 세션당 프롬프트 수 집계 | 세션 복잡도 분석 |

### 5.2 추가 수집 권장 OTel 속성

현재 Lambda 변환기에서 추출하지 않지만 OTel 스펙에서 추가 가능한 속성:

| 속성 | OTel 키 | 용도 |
|------|---------|------|
| 로그 심각도 | `SeverityText` / `SeverityNumber` | 에러 레벨 기반 필터링 |
| Trace ID | `TraceId` | 분산 추적 연계 |
| Span ID | `SpanId` | 개별 작업 단위 추적 |
| 텔레메트리 SDK 버전 | `telemetry.sdk.version` | SDK 호환성 분석 |

---

## 6. 대시보드 관점 분석 차원 제안

### 6.1 Cross-Event 조인 기반 파생 메트릭

동일 `session_id`를 키로 서로 다른 `event_name` 이벤트를 조인하면 다음과 같은 고급 메트릭 도출 가능.

#### 세션 수준 집계 메트릭

```sql
-- 세션별 종합 통계: api_request + tool_result + user_prompt 조인
SELECT
    session_id,
    MIN("timestamp") AS session_start,
    MAX("timestamp") AS session_end,
    date_diff('second', MIN("timestamp"), MAX("timestamp")) AS session_duration_sec,
    -- API 관련
    COUNT(CASE WHEN event_name = 'claude_code.api_request' THEN 1 END) AS api_calls,
    SUM(CASE WHEN event_name = 'claude_code.api_request' THEN cost_usd ELSE 0 END) AS total_cost,
    SUM(CASE WHEN event_name = 'claude_code.api_request' THEN input_tokens + output_tokens ELSE 0 END) AS total_tokens,
    -- 도구 관련
    COUNT(CASE WHEN event_name = 'claude_code.tool_result' THEN 1 END) AS tool_executions,
    SUM(CASE WHEN event_name = 'claude_code.tool_result' AND success = false THEN 1 ELSE 0 END) AS tool_failures,
    -- 프롬프트 관련
    COUNT(CASE WHEN event_name = 'claude_code.user_prompt' THEN 1 END) AS prompt_count,
    AVG(CASE WHEN event_name = 'claude_code.user_prompt' THEN prompt_length END) AS avg_prompt_length
FROM claude_code_telemetry.events
GROUP BY session_id
```

#### 제안하는 파생 메트릭 목록

| 파생 메트릭 | 계산 방식 | 분석 가치 |
|-------------|-----------|-----------|
| **세션 지속 시간** | `MAX(timestamp) - MIN(timestamp)` per session_id | 사용자 생산성 측정 |
| **세션당 프롬프트 수** | COUNT(user_prompt) per session_id | 대화 복잡도 분석 |
| **프롬프트당 비용** | total_cost / prompt_count per session_id | 비용 효율성 지표 |
| **프롬프트당 API 호출 수** | api_calls / prompt_count per session_id | AI 활용 강도 |
| **도구 사용 비율** | tool_executions / api_calls per session_id | 도구 의존도 분석 |
| **도구 실패율 추이** | tool_failures / tool_executions 시계열 | 안정성 모니터링 |
| **평균 프롬프트 길이 추이** | AVG(prompt_length) 시계열 | 사용 패턴 변화 감지 |
| **캐시 효율성** | cache_read_tokens / (cache_read_tokens + cache_creation_tokens) | 캐시 최적화 수준 |
| **도구-비용 상관관계** | 도구 실행 후 발생한 API 호출 비용 | 도구별 비용 기여도 |
| **세션 복잡도 점수** | prompts * avg_prompt_length * tools_used (정규화) | 작업 난이도 분류 |
| **API 호출 간격** | 연속 api_request 간 시간 차이 | 사용 패턴(번 아웃, 배치) 분류 |
| **속도 모드별 비용 효율** | cost_usd / output_tokens by speed | 속도 vs 비용 트레이드오프 |
| **버전별 비용 변동** | SUM(cost_usd) grouped by service_version 시계열 | 업그레이드 비용 영향 분석 |

### 6.2 신규 대시보드 패널 제안

#### (A) "Session Intelligence" 대시보드 (신규)

| 패널 | 시각화 타입 | 사용 필드 | 설명 |
|------|-----------|-----------|------|
| 세션 지속 시간 분포 | Histogram | session_id, timestamp | 세션 길이 분포를 파악하여 사용 패턴 이해 |
| 세션당 비용 분포 | Histogram | session_id, cost_usd | 고비용 세션 식별 |
| 프롬프트당 비용 추이 | Time series | user_prompt, cost_usd | 비용 효율성 시계열 모니터링 |
| 세션 복잡도 히트맵 | Heatmap | prompts, tools, api_calls | 시간대별 세션 복잡도 패턴 |
| 버전별 세션 통계 | Table | service_version, session_id | 버전 업그레이드 전후 비교 |

#### (B) 기존 대시보드 강화 제안

**Cost 대시보드 추가 패널:**

| 패널 | 설명 | 미사용 필드 활용 |
|------|------|-----------------|
| 부서별 비용 | department별 비용 바 차트 | `department` |
| 비용 센터별 차지백 | cost_center별 비용 테이블 | `cost_center` |
| 속도 모드별 비용 비교 | speed별 비용/토큰 효율 | `speed` |
| 조직별 비용 | organization_id별 필터 | `organization_id` |
| 프롬프트 길이 vs 비용 상관관계 | 스캐터 플롯 | `prompt_length`, `cost_usd` |

**Tool Analytics 대시보드 추가 패널:**

| 패널 | 설명 | 미사용 필드 활용 |
|------|------|-----------------|
| 결정 소스 분포 | source별 accept/reject 비율 | `source` |
| 도구 결과 크기 분포 | 도구별 result_size_bytes 박스 플롯 | `tool_result_size_bytes` |
| 도구별 비용 기여도 | 도구 사용 후 API 비용 연관 분석 | cross-event 조인 |

**Usage 대시보드 추가 패널:**

| 패널 | 설명 | 미사용 필드 활용 |
|------|------|-----------------|
| 버전별 사용 추이 | service_version별 세션 수 시계열 | `service_version` |
| 아키텍처 분포 | host_arch별 세션 수 파이 차트 | `host_arch` |
| 프롬프트 길이 분포 | prompt_length 히스토그램 | `prompt_length` |
| 세션당 프롬프트 수 분포 | 세션별 user_prompt 이벤트 수 | `prompt_id` cross-event |

**API Performance 대시보드 추가 패널:**

| 패널 | 설명 | 미사용 필드 활용 |
|------|------|-----------------|
| 속도 모드별 레이턴시 비교 | speed별 p50/p90/p99 레이턴시 | `speed` |
| 버전별 API 성능 추이 | service_version별 평균 레이턴시 | `service_version` |

### 6.3 분석 차원 우선순위 요약

| 우선순위 | 분석 차원 | 필요 필드 | 기대 가치 |
|----------|-----------|-----------|-----------|
| **P0 (즉시)** | 세션 지속 시간 / 세션 복잡도 | session_id, timestamp (cross-event) | 사용 패턴 핵심 인사이트 |
| **P0 (즉시)** | 프롬프트 수 / 프롬프트 길이 분석 | prompt_length, prompt_id (user_prompt) | 사용 효율성 분석 |
| **P0 (즉시)** | 속도 모드별 비용/성능 | speed (api_request) | 속도 모드 최적화 |
| **P1 (중요)** | 부서/비용 센터별 비용 | department, cost_center | FinOps 비용 관리 |
| **P1 (중요)** | 버전별 추이 분석 | service_version | 업그레이드 영향 추적 |
| **P1 (중요)** | 도구 결과 크기 모니터링 | tool_result_size_bytes | 성능 이슈 탐지 |
| **P1 (중요)** | 도구 결정 소스 분석 | source | 자동화 수준 추적 |
| **P2 (보완)** | 조직별 분석 | organization_id | 멀티 테넌트 지원 |
| **P2 (보완)** | 아키텍처별 분석 | host_arch | 인프라 최적화 |
| **P2 (보완)** | OS 버전 세분화 | os_version | 호환성 관리 |

---

## 7. 현재 대시보드 기술적 특징 요약

### 7.1 공통 패턴
- **데이터소스:** 전체 Athena (grafana-athena-datasource)
- **파티션 프루닝:** 모든 쿼리에 `LPAD(CAST(year AS VARCHAR),...) BETWEEN ...` 패턴으로 파티션 필터링 적용
- **시간 필터:** `from_iso8601_timestamp` 함수로 Grafana 시간 범위 변환
- **필터 변수:** team_id, user (COALESCE(user_name, user_id)), model 조합

### 7.2 대시보드 구성 현황

| 대시보드 | 패널 수 | 필터 변수 | 시각화 타입 |
|----------|---------|-----------|------------|
| Overview | 10 | team, user | stat(4), timeseries(2), table(2), piechart(1), table(1) |
| Cost | 10 | team, user, model | stat(3), timeseries(2), barchart(3), table(1), piechart(1) |
| Usage | 10 | team, user, model | stat(4), timeseries(1), barchart(2), piechart(2), table(1) |
| Tool Analytics | 11 | team, tool | stat(4), barchart(1), piechart(1), timeseries(1), table(4) |
| API Performance | 9 | model, team | stat(3), timeseries(2), barchart(2), table(2) |
| **합계** | **50 패널** | | |

### 7.3 대시보드간 네비게이션
- 모든 대시보드에 상호 링크 설정됨
- Overview의 "Top 5 Users by Cost" 테이블에서 Cost 대시보드로 drill-down 링크
- Overview의 "Top 5 Users by Tokens" 테이블에서 Usage 대시보드로 drill-down 링크
