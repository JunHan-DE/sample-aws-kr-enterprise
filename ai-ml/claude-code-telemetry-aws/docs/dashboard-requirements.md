# 대시보드 시각화 요구사항 정의서

## 목차

1. [데이터 분석 요약](#1-데이터-분석-요약)
2. [컬럼별 데이터 품질 분석](#2-컬럼별-데이터-품질-분석)
3. [핵심 인사이트](#3-핵심-인사이트)
4. [KPI 및 메트릭 정의](#4-kpi-및-메트릭-정의)
5. [분석 차원 (Dimensions)](#5-분석-차원-dimensions)
6. [대시보드별 시각화 요구사항](#6-대시보드별-시각화-요구사항)
7. [Athena 쿼리 패턴](#7-athena-쿼리-패턴)

---

## 1. 데이터 분석 요약

### 1.1 분석 대상

| 항목 | 값 |
|---|---|
| Athena DB / Table | `claude_code_telemetry.events` |
| 분석 파티션 | `year=2026/month=02/day=19/hour=15` |
| 총 레코드 수 | 52건 |
| 세션 수 | 1 |
| 사용자 수 | 1 (user1) |

### 1.2 이벤트 유형별 분포

| 이벤트 | 건수 | 비율 |
|---|---|---|
| `claude_code.api_request` | 33 | 63.5% |
| `claude_code.tool_result` | 9 | 17.3% |
| `claude_code.tool_decision` | 8 | 15.4% |
| `claude_code.user_prompt` | 2 | 3.8% |
| `claude_code.api_error` | 0 | 0% |

**인사이트**: API 요청이 전체의 63.5%로 가장 많다. 하나의 사용자 프롬프트 당 약 16.5회의 API 호출이 발생하며, 이는 Claude Code의 멀티턴 에이전트 특성(도구 호출 -> 결과 -> 후속 API 호출)을 반영한다. `api_error` 이벤트가 0건으로, 해당 세션에서는 API 오류가 없었다.

### 1.3 세션 요약

| 항목 | 값 |
|---|---|
| 세션 ID | `edacb8ca-e4c2-4743-9deb-76c5c965224f` |
| 사용자 | user1 |
| 세션 시작 | 2026-02-19 15:42:49 UTC |
| 세션 종료 | 2026-02-19 16:00:37 UTC |
| 세션 지속 시간 | 1,068초 (약 17.8분) |
| 총 이벤트 | 52건 |
| 프롬프트 수 | 2 |
| API 호출 수 | 33 |
| 도구 사용 수 | 9 |
| 도구 결정 수 | 8 |
| 총 비용 | $1.173386 |
| 총 입력 토큰 | 18,485 |
| 총 출력 토큰 | 2,580 |
| 캐시 읽기 토큰 | 175,471 |
| 캐시 생성 토큰 | 148,596 |

---

## 2. 컬럼별 데이터 품질 분석

### 2.1 공통 필드 NULL 비율

| 컬럼 | 전체 NULL 비율 | 비고 |
|---|---|---|
| `event_name` | 0% | 항상 존재 |
| `session_id` | 0% | 항상 존재 |
| `timestamp` | 0% | 항상 존재 |
| `organization_id` | **100%** | 현재 데이터에서 미설정 |
| `user_id` | 0% | 항상 존재 (해시값) |
| `user_name` | 0% | 항상 존재 |
| `terminal_type` | 0% | 항상 존재 |
| `service_name` | 0% | 항상 `claude-code` |
| `service_version` | 0% | 항상 존재 (`2.1.47`) |
| `os_type` | 0% | 항상 존재 (`darwin`) |
| `os_version` | 0% | 항상 존재 (`25.2.0`) |
| `host_arch` | 0% | 항상 존재 (`arm64`) |
| `department` | **100%** | 커스텀 리소스 속성 미설정 |
| `team_id` | **100%** | 커스텀 리소스 속성 미설정 |
| `cost_center` | **100%** | 커스텀 리소스 속성 미설정 |
| `prompt_id` | 0% | 모든 이벤트에 존재 (세션 내 프롬프트 추적용) |

### 2.2 고유값 분포

| 컬럼 | 고유값 수 | 실제 값 |
|---|---|---|
| `session_id` | 1 | UUID 1개 |
| `user_id` | 1 | SHA-256 해시 1개 |
| `user_name` | 1 | `user1` |
| `terminal_type` | 1 | `ghostty` |
| `service_version` | 1 | `2.1.47` |
| `os_type` | 1 | `darwin` |
| `model` | 2 | `claude-opus-4-6`, `claude-sonnet-4-6` |
| `tool_name` | 2 | `Bash`, `Read` |
| `speed` | 1 | `normal` |
| `decision` | 1 | `accept` |
| `source` | 1 | `config` |

### 2.3 대시보드 설계 시 고려사항

- **`organization_id`, `department`, `team_id`, `cost_center`**: 현재 데이터에서 모두 NULL이므로, OTEL_RESOURCE_ATTRIBUTES 환경변수 설정이 필요하다. 대시보드에서는 이 필드들이 설정된 경우와 미설정(NULL)인 경우 모두 처리해야 한다.
- **`prompt_id`**: user_prompt 이벤트뿐 아니라 모든 이벤트에 존재한다. 이를 통해 특정 프롬프트에서 파생된 모든 API 호출과 도구 사용을 추적할 수 있다 (프롬프트 단위 비용 분석 가능).
- **`api_error`**: 이번 데이터에는 없지만, 스키마상 정의되어 있으므로 대시보드에서 반드시 고려해야 한다.

---

## 3. 핵심 인사이트

### 3.1 비용 분석

#### 모델별 비용 비교

| 모델 | API 호출 수 | 총 비용 | 평균 비용/호출 | 최소 | 최대 |
|---|---|---|---|---|---|
| `claude-opus-4-6` | 9 (27.3%) | $1.0586 (90.2%) | $0.1176 | $0.0224 | $0.2473 |
| `claude-sonnet-4-6` | 24 (72.7%) | $0.1148 (9.8%) | $0.0048 | $0.0023 | $0.0167 |

**인사이트**: Opus 모델은 호출 수 기준으로는 27.3%에 불과하지만 비용의 90.2%를 차지한다. Opus 1회 호출 평균 비용($0.1176)은 Sonnet 1회 호출 평균 비용($0.0048)의 약 24.5배이다. 비용 최적화를 위해서는 Opus 사용 비율 모니터링이 핵심이다.

#### 세션 단위 비용

- 세션 총 비용: $1.17
- 분당 비용: $0.066/min
- 프롬프트당 비용: $0.587/prompt
- API 호출당 평균 비용: $0.036/call

### 3.2 토큰 사용 분석

#### 모델별 토큰 분포

| 모델 | 입력 토큰 | 출력 토큰 | 캐시 읽기 | 캐시 생성 | 입출력 비율 |
|---|---|---|---|---|---|
| `claude-opus-4-6` | 601 | 2,200 | 175,471 | 146,052 | 1:3.66 |
| `claude-sonnet-4-6` | 17,884 | 380 | 0 | 2,544 | 47:1 |

**인사이트**:
- Opus는 출력 토큰이 입력보다 3.66배 많아, 복잡한 추론 및 코드 생성 작업에 주로 사용된다.
- Sonnet은 입력이 출력의 47배로, 짧은 판단(도구 선택, 라우팅)에 주로 사용된다.
- 이 패턴은 Claude Code의 라우터(Sonnet) + 작업 수행(Opus) 아키텍처를 반영한다.

### 3.3 캐시 효율성

| 모델 | 캐시 재사용률 | 캐시 읽기 토큰 비중 |
|---|---|---|
| `claude-opus-4-6` | 54.57% | 54.47% |
| `claude-sonnet-4-6` | 0.0% | 0.0% |

**인사이트**: Opus 모델에서만 캐시가 활용되고 있으며, 캐시 재사용률은 54.57%이다. 전체 Opus 토큰(input + cache_read + cache_create = 322,124) 중 캐시 읽기가 54.47%를 차지하여, 캐시가 비용 절감에 크게 기여하고 있다. Sonnet은 캐시를 전혀 활용하지 못하고 있어 개선 여지가 있다.

### 3.4 API 성능

| 모델 | 평균 지연(ms) | 최소(ms) | 최대(ms) |
|---|---|---|---|
| `claude-opus-4-6` | 6,423 | 3,620 | 11,575 |
| `claude-sonnet-4-6` | 1,300 | 951 | 1,942 |

**인사이트**: Opus는 평균 6.4초, Sonnet은 평균 1.3초의 응답 시간을 보인다. Opus의 최대 지연이 11.6초로, 사용자 경험 관점에서 모니터링이 필요하다.

### 3.5 도구 사용 분석

#### 도구별 실행 결과 (tool_result)

| 도구 | 실행 수 | 성공 | 실패 | 성공률 | 평균 소요시간 | 최대 소요시간 | 평균 결과 크기 |
|---|---|---|---|---|---|---|---|
| Bash | 8 | 6 | 2 | 75.0% | 590,973ms | 4,711,155ms | 1,448 bytes |
| Read | 1 | 1 | 0 | 100.0% | 26ms | 26ms | 190 bytes |

**인사이트**:
- Bash 도구의 평균 소요 시간이 매우 높다(~591초). 최대 4,711초(약 78.5분)의 극단값이 있어 평균을 크게 왜곡하고 있다. 이는 장시간 실행되는 빌드/배포 명령으로 추정된다.
- Bash 성공률이 75%로, 실패 2건에 대한 원인 분석이 필요할 수 있다.
- Read 도구는 26ms로 매우 빠르게 응답한다.

#### 도구 결정 (tool_decision)

| 도구 | 결정 | 출처 | 건수 |
|---|---|---|---|
| Bash | accept | config | 7 |
| Read | accept | config | 1 |

**인사이트**: 모든 도구 결정이 `accept`이며, 출처가 `config`(자동 승인 설정)이다. `reject` 건이 0건이므로, 현재 환경에서는 모든 도구가 자동 승인되고 있다. 프로덕션 환경에서 도구 거부 패턴을 모니터링하는 것이 보안 관점에서 중요하다.

### 3.6 프롬프트 분석

| 프롬프트 ID | 길이(chars) |
|---|---|
| `8fcb1505-37a2-4350-9e67-05f1abd311e0` | 28 |
| `ad8f15a1-ffad-49d6-9aa9-7b864b5cc9f3` | 483 |

**인사이트**: 프롬프트 길이 편차가 크다(28자 vs 483자). 짧은 프롬프트는 간단한 명령, 긴 프롬프트는 복잡한 요구사항으로 추정된다. 프롬프트 길이와 비용/토큰 소비의 상관관계 분석이 가능하다.

---

## 4. KPI 및 메트릭 정의

### 4.1 비용 효율성 메트릭

| 메트릭 ID | 메트릭명 | 계산 방식 | 단위 | 대시보드 |
|---|---|---|---|---|
| COST-01 | 총 비용 | `SUM(cost_usd) WHERE event_name='api_request'` | USD | Overview, Cost |
| COST-02 | 세션당 비용 | `SUM(cost_usd) / COUNT(DISTINCT session_id)` | USD/session | Cost |
| COST-03 | 사용자당 비용 | `SUM(cost_usd) GROUP BY user_name` | USD/user | Cost |
| COST-04 | 모델별 비용 | `SUM(cost_usd) GROUP BY model` | USD/model | Cost |
| COST-05 | 모델별 비용 비중 | `SUM(cost_usd) WHERE model=X / SUM(cost_usd) * 100` | % | Cost |
| COST-06 | 프롬프트당 비용 | `SUM(cost_usd) / COUNT(DISTINCT prompt_id WHERE event_name='user_prompt')` | USD/prompt | Cost |
| COST-07 | API 호출당 비용 | `SUM(cost_usd) / COUNT(*) WHERE event_name='api_request'` | USD/call | Cost |
| COST-08 | 분당 비용 | 세션 지속 시간 기반 계산 | USD/min | Cost |

### 4.2 생산성 메트릭

| 메트릭 ID | 메트릭명 | 계산 방식 | 단위 | 대시보드 |
|---|---|---|---|---|
| PROD-01 | 세션당 프롬프트 수 | `COUNT(*) WHERE event_name='user_prompt' / COUNT(DISTINCT session_id)` | prompts/session | Overview, Usage |
| PROD-02 | 세션당 API 호출 수 | `COUNT(*) WHERE event_name='api_request' / COUNT(DISTINCT session_id)` | calls/session | Usage |
| PROD-03 | 세션당 도구 사용 수 | `COUNT(*) WHERE event_name='tool_result' / COUNT(DISTINCT session_id)` | tools/session | Usage |
| PROD-04 | 프롬프트당 API 호출 수 | `COUNT(api_request) / COUNT(user_prompt)` | calls/prompt | Usage |
| PROD-05 | 세션 지속 시간 | `MAX(timestamp) - MIN(timestamp) GROUP BY session_id` | 초 | Overview, Usage |
| PROD-06 | 활성 사용자 수 | `COUNT(DISTINCT user_id)` | users | Overview |
| PROD-07 | 활성 세션 수 | `COUNT(DISTINCT session_id)` | sessions | Overview |

### 4.3 품질 메트릭

| 메트릭 ID | 메트릭명 | 계산 방식 | 단위 | 대시보드 |
|---|---|---|---|---|
| QUAL-01 | 도구 성공률 | `SUM(success=true) / COUNT(*) WHERE event_name='tool_result' * 100` | % | Tool Analytics |
| QUAL-02 | 도구별 성공률 | 위와 동일, `GROUP BY tool_name` | % | Tool Analytics |
| QUAL-03 | API 오류율 | `COUNT(api_error) / (COUNT(api_request) + COUNT(api_error)) * 100` | % | API Performance |
| QUAL-04 | 도구 승인율 | `SUM(decision='accept') / COUNT(*) WHERE event_name='tool_decision' * 100` | % | Tool Analytics |
| QUAL-05 | 도구 거부율 | `SUM(decision='reject') / COUNT(*) WHERE event_name='tool_decision' * 100` | % | Tool Analytics |
| QUAL-06 | 캐시 적중률 | `SUM(cache_read_tokens > 0) / COUNT(*) WHERE event_name='api_request' * 100` | % | API Performance |
| QUAL-07 | 캐시 토큰 재사용률 | `SUM(cache_read_tokens) / (SUM(cache_read_tokens) + SUM(cache_creation_tokens)) * 100` | % | API Performance |

### 4.4 성능 메트릭

| 메트릭 ID | 메트릭명 | 계산 방식 | 단위 | 대시보드 |
|---|---|---|---|---|
| PERF-01 | API 응답 지연 (p50) | `APPROX_PERCENTILE(duration_ms, 0.50) WHERE event_name='api_request'` | ms | API Performance |
| PERF-02 | API 응답 지연 (p90) | `APPROX_PERCENTILE(duration_ms, 0.90)` | ms | API Performance |
| PERF-03 | API 응답 지연 (p99) | `APPROX_PERCENTILE(duration_ms, 0.99)` | ms | API Performance |
| PERF-04 | 도구 실행 시간 (평균) | `AVG(duration_ms) WHERE event_name='tool_result' GROUP BY tool_name` | ms | Tool Analytics |
| PERF-05 | 도구 실행 시간 (p95) | `APPROX_PERCENTILE(duration_ms, 0.95) GROUP BY tool_name` | ms | Tool Analytics |

---

## 5. 분석 차원 (Dimensions)

### 5.1 사용 가능 차원

데이터에서 확인된 분석 축(Dimension)과 대시보드 필터로의 활용 가능성을 정리한다.

| 차원 | 필드 | 현재 데이터 가용성 | 다중 사용자 환경 기대값 | 필터 사용 |
|---|---|---|---|---|
| **시간** | `year`, `month`, `day`, `hour`, `timestamp` | O | O | Grafana 기본 시간 범위 |
| **사용자** | `user_name`, `user_id` | 1명 | 다수 | 드롭다운 필터 |
| **세션** | `session_id` | 1개 | 다수 | 드롭다운 필터 |
| **모델** | `model` | 2종 (opus, sonnet) | 2종+ | 드롭다운 필터 |
| **속도 모드** | `speed` | 1종 (normal) | normal, fast 등 | 드롭다운 필터 |
| **도구** | `tool_name` | 2종 (Bash, Read) | 다수 (Write, Edit, Grep, Glob 등) | 드롭다운 필터 |
| **결정** | `decision` | 1종 (accept) | accept, reject | 드롭다운 필터 |
| **결정 출처** | `source` | 1종 (config) | config, user, auto 등 | 드롭다운 필터 |
| **터미널** | `terminal_type` | 1종 (ghostty) | ghostty, vscode, iterm 등 | 드롭다운 필터 |
| **OS** | `os_type` | 1종 (darwin) | darwin, linux, windows | 드롭다운 필터 |
| **아키텍처** | `host_arch` | 1종 (arm64) | arm64, x86_64 | 드롭다운 필터 |
| **버전** | `service_version` | 1종 (2.1.47) | 다수 | 드롭다운 필터 |
| **조직** | `organization_id` | NULL | 설정 시 가용 | 드롭다운 필터 |
| **부서** | `department` | NULL | 설정 시 가용 | 드롭다운 필터 |
| **팀** | `team_id` | NULL | 설정 시 가용 | 드롭다운 필터 |
| **비용 센터** | `cost_center` | NULL | 설정 시 가용 | 드롭다운 필터 |

### 5.2 차원 조합 우선순위

대시보드별로 가장 유용한 차원 조합:

1. **비용 분석**: 시간 x 사용자 x 모델
2. **사용량 분석**: 시간 x 사용자 x 세션
3. **도구 분석**: 도구 x 결정 x 사용자
4. **성능 분석**: 모델 x 시간
5. **관리자 뷰**: 부서 x 팀 x 비용 센터 (커스텀 속성 설정 시)

---

## 6. 대시보드별 시각화 요구사항

### 6.1 Dashboard 1: Overview (개요)

**목적**: 전체 현황을 한눈에 파악하는 요약 대시보드

**데이터 소스**: Athena (`claude_code_telemetry.events`)

#### 필터

| 변수명 | 소스 | 쿼리 |
|---|---|---|
| `$timeRange` | Grafana 내장 | - |
| `$user` | Athena | `SELECT DISTINCT user_name FROM events WHERE ...파티션 필터...` |
| `$model` | Athena | `SELECT DISTINCT model FROM events WHERE event_name='claude_code.api_request' AND ...파티션 필터...` |

#### 패널 구성

##### Row 1: 핵심 지표 (Stat 패널, 4개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 총 세션 수 | PROD-07 | Stat | 6x4 | sparkline 포함, 전일 대비 증감 |
| 총 비용 | COST-01 | Stat | 6x4 | USD 포맷, 전일 대비 증감 |
| 활성 사용자 | PROD-06 | Stat | 6x4 | 전일 대비 증감 |
| 총 토큰 | `SUM(input_tokens + output_tokens)` | Stat | 6x4 | K/M 단위 표시 |

##### Row 2: 시계열 추이 (2개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 세션 수 추이 | 시간별 `COUNT(DISTINCT session_id)` | Time Series | 12x8 | 시간 단위 집계 |
| 비용 추이 | 시간별 `SUM(cost_usd)` | Time Series | 12x8 | 모델별 stack |

##### Row 3: 순위 테이블 (2개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 비용 상위 사용자 | COST-03, 상위 10 | Table | 12x8 | user_name, total_cost, api_calls |
| 토큰 상위 사용자 | 입출력 토큰 합산, 상위 10 | Table | 12x8 | user_name, total_tokens, sessions |

##### Row 4: 이벤트 분포 (2개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 이벤트 유형 분포 | `COUNT(*) GROUP BY event_name` | Pie Chart | 12x8 | 도넛 형태 |
| 모델별 사용 비율 | `COUNT(*) WHERE api_request GROUP BY model` | Pie Chart | 12x8 | 호출 수 vs 비용 비교 |

---

### 6.2 Dashboard 2: Cost (비용 분석)

**목적**: 비용 최적화를 위한 상세 비용 분석

**데이터 소스**: Athena

#### 필터

| 변수명 | 소스 | 쿼리 |
|---|---|---|
| `$timeRange` | Grafana 내장 | - |
| `$user` | Athena | `SELECT DISTINCT user_name` |
| `$model` | Athena | `SELECT DISTINCT model` |

#### 패널 구성

##### Row 1: 비용 요약 (Stat 패널, 4개)

| 패널 | 메트릭 | 차트 타입 | 크기 |
|---|---|---|---|
| 총 비용 | COST-01 | Stat | 6x4 |
| 세션당 평균 비용 | COST-02 | Stat | 6x4 |
| 프롬프트당 평균 비용 | COST-06 | Stat | 6x4 |
| API 호출당 평균 비용 | COST-07 | Stat | 6x4 |

##### Row 2: 비용 추이 (2개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 시간별 비용 추이 | 시간별 `SUM(cost_usd)` | Time Series (stacked) | 12x8 | 모델별 색상 구분 |
| 누적 비용 추이 | `SUM(cost_usd)` 누적 | Time Series | 12x8 | 목표 예산선 추가 가능 |

##### Row 3: 모델별 비용 분석 (2개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 모델별 비용 분포 | COST-04, COST-05 | Pie Chart | 12x8 | 비용 비중 표시 |
| 모델별 비용 효율성 | 호출당 비용, 토큰당 비용 비교 | Bar Chart (grouped) | 12x8 | 모델별 비교 |

##### Row 4: 사용자별 비용 (2개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 사용자별 비용 순위 | COST-03, 상위 20 | Bar Chart (horizontal) | 12x10 | 내림차순 정렬 |
| 사용자별 비용 상세 | user, sessions, cost, avg_cost/session | Table | 12x10 | 정렬 가능 |

##### Row 5: 캐시 비용 절감 (2개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 캐시 절감 금액 추정 | `cache_read_tokens * 단가 차이` | Stat + Time Series | 12x8 | 캐시 없을 때 vs 있을 때 비용 비교 |
| 모델별 캐시 재사용률 | QUAL-07 | Gauge | 12x8 | 목표 60% 이상 |

---

### 6.3 Dashboard 3: Usage (사용량)

**목적**: 토큰 사용량, 세션 활동량 분석

**데이터 소스**: Athena

#### 필터

| 변수명 | 소스 |
|---|---|
| `$timeRange` | Grafana 내장 |
| `$user` | Athena |
| `$model` | Athena |

#### 패널 구성

##### Row 1: 토큰 요약 (Stat 패널, 4개)

| 패널 | 메트릭 | 차트 타입 | 크기 |
|---|---|---|---|
| 총 입력 토큰 | `SUM(input_tokens)` | Stat | 6x4 |
| 총 출력 토큰 | `SUM(output_tokens)` | Stat | 6x4 |
| 총 캐시 읽기 토큰 | `SUM(cache_read_tokens)` | Stat | 6x4 |
| 총 캐시 생성 토큰 | `SUM(cache_creation_tokens)` | Stat | 6x4 |

##### Row 2: 토큰 추이 (2개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 시간별 토큰 사용량 | input/output/cache 토큰 | Time Series (stacked) | 12x8 | 토큰 유형별 색상 |
| 모델별 토큰 분포 | 모델 x 토큰 유형 | Bar Chart (stacked) | 12x8 | 입력/출력/캐시 구분 |

##### Row 3: 세션 활동 (2개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 세션별 활동 요약 | PROD-01~05 | Table | 12x10 | session_id, user, prompts, api_calls, tools, duration, cost |
| 세션 지속 시간 분포 | PROD-05 히스토그램 | Histogram | 12x8 | 분 단위 |

##### Row 4: 사용 패턴 (2개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 시간대별 사용 패턴 | 시간(hour)별 세션/이벤트 수 | Heatmap 또는 Bar | 12x8 | UTC 시간대 |
| 프롬프트 길이 분포 | `prompt_length` 히스토그램 | Histogram | 12x8 | 구간별 빈도 |

---

### 6.4 Dashboard 4: Tool Analytics (도구 분석)

**목적**: Claude Code가 사용하는 도구(Bash, Read, Write 등)의 사용 패턴과 성능 분석

**데이터 소스**: Athena

#### 필터

| 변수명 | 소스 |
|---|---|
| `$timeRange` | Grafana 내장 |
| `$user` | Athena |
| `$tool` | Athena: `SELECT DISTINCT tool_name FROM events WHERE event_name IN ('claude_code.tool_result','claude_code.tool_decision')` |

#### 패널 구성

##### Row 1: 도구 요약 (Stat 패널, 4개)

| 패널 | 메트릭 | 차트 타입 | 크기 |
|---|---|---|---|
| 총 도구 실행 수 | `COUNT(*) WHERE tool_result` | Stat | 6x4 |
| 전체 성공률 | QUAL-01 | Stat (Gauge) | 6x4 |
| 전체 승인율 | QUAL-04 | Stat (Gauge) | 6x4 |
| 고유 도구 종류 수 | `COUNT(DISTINCT tool_name)` | Stat | 6x4 |

##### Row 2: 도구별 사용 빈도 (2개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 도구별 사용 빈도 | `COUNT(*) GROUP BY tool_name` | Bar Chart (horizontal) | 12x8 | 내림차순 |
| 도구별 성공/실패 비율 | QUAL-02 | Stacked Bar | 12x8 | 성공(녹)/실패(적) |

##### Row 3: 도구 성능 (2개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 도구별 실행 시간 분포 | PERF-04, PERF-05 | Box Plot 또는 Bar (p50/p95/max) | 12x8 | 로그 스케일 고려 |
| 도구별 결과 크기 | `AVG(tool_result_size_bytes) GROUP BY tool_name` | Bar Chart | 12x8 | bytes 단위 |

##### Row 4: 도구 결정 분석 (2개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 도구별 승인/거부 비율 | QUAL-04, QUAL-05 | Stacked Bar | 12x8 | accept(녹)/reject(적) |
| 결정 출처 분포 | `COUNT(*) GROUP BY source` | Pie Chart | 12x8 | config, user, auto 구분 |

##### Row 5: 도구 상세 로그 (1개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 도구 실행 로그 | timestamp, tool_name, success, duration_ms, result_size, error | Table | 24x10 | 최신순, 페이지네이션 |

---

### 6.5 Dashboard 5: API Performance (API 성능)

**목적**: Claude API 호출 성능 및 오류 모니터링

**데이터 소스**: Athena

#### 필터

| 변수명 | 소스 |
|---|---|
| `$timeRange` | Grafana 내장 |
| `$user` | Athena |
| `$model` | Athena |

#### 패널 구성

##### Row 1: 성능 요약 (Stat 패널, 4개)

| 패널 | 메트릭 | 차트 타입 | 크기 |
|---|---|---|---|
| 총 API 호출 수 | `COUNT(*) WHERE api_request` | Stat | 6x4 |
| API 오류율 | QUAL-03 | Stat (Gauge) | 6x4 |
| 평균 응답 시간 | `AVG(duration_ms)` | Stat | 6x4 |
| 캐시 적중률 | QUAL-06 | Stat (Gauge) | 6x4 |

##### Row 2: 지연 시간 분석 (2개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 모델별 응답 시간 백분위수 | PERF-01~03 | Grouped Bar | 12x8 | p50, p90, p95, p99 |
| 시간별 응답 시간 추이 | `AVG(duration_ms)` 시계열 | Time Series | 12x8 | 모델별 라인 |

##### Row 3: 캐시 분석 (2개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 모델별 캐시 효율성 | QUAL-07 | Gauge (2개) | 12x8 | 모델별 게이지 |
| 캐시 토큰 구성 | cache_read vs cache_create | Stacked Bar | 12x8 | 모델별 |

##### Row 4: 오류 분석 (2개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| 오류 유형 분포 | `COUNT(*) WHERE api_error GROUP BY status_code` | Pie Chart | 12x8 | status_code별 |
| 시간별 오류 추이 | `COUNT(*) WHERE api_error` 시계열 | Time Series | 12x8 | 0건이어도 표시 |

##### Row 5: API 호출 상세 (1개)

| 패널 | 메트릭 | 차트 타입 | 크기 | 비고 |
|---|---|---|---|---|
| API 호출 로그 | timestamp, model, duration_ms, cost_usd, tokens, cache | Table | 24x10 | 최신순, 필터링 가능 |

---

## 7. Athena 쿼리 패턴

### 7.1 Grafana에서 Athena 쿼리 사용 시 주의사항

1. **파티션 필터 필수**: 모든 쿼리에 `year`, `month`, `day`, `hour` 파티션 필터를 반드시 포함해야 한다. Grafana의 `$__timeFilter` 매크로가 없으므로 시간 범위를 직접 매핑해야 한다.

2. **시간 범위 매핑**: Grafana의 `$__from`/`$__to` 변수를 Athena 파티션 필터로 변환하는 방법:
   ```sql
   WHERE year || '-' || month || '-' || day || ' ' || hour || ':00:00'
     BETWEEN '$__from' AND '$__to'
   ```
   또는 파티션 키를 개별 필터링:
   ```sql
   WHERE CONCAT(year, month, day, hour)
     BETWEEN DATE_FORMAT(TIMESTAMP '$__from', '%Y%m%d%H')
     AND DATE_FORMAT(TIMESTAMP '$__to', '%Y%m%d%H')
   ```

3. **NULL 안전 처리**: `organization_id`, `department`, `team_id`, `cost_center`가 NULL일 수 있으므로 `COALESCE()` 또는 `IS NOT NULL` 필터 적용.

4. **비용 계산 정밀도**: `cost_usd`는 DOUBLE 타입이므로 `ROUND()` 함수로 소수점 관리.

### 7.2 대시보드별 핵심 쿼리

#### Overview - 핵심 지표

```sql
-- 세션 수, 비용, 사용자 수, 토큰 수 (한 번에 조회)
SELECT
    COUNT(DISTINCT session_id) AS total_sessions,
    COUNT(DISTINCT user_id) AS active_users,
    ROUND(SUM(CASE WHEN event_name = 'claude_code.api_request' THEN cost_usd ELSE 0 END), 2) AS total_cost,
    SUM(CASE WHEN event_name = 'claude_code.api_request' THEN input_tokens + output_tokens ELSE 0 END) AS total_tokens
FROM claude_code_telemetry.events
WHERE year = '$year' AND month = '$month' AND day = '$day'
```

#### Cost - 모델별 비용 분석

```sql
SELECT
    model,
    COUNT(*) AS api_calls,
    ROUND(SUM(cost_usd), 4) AS total_cost,
    ROUND(AVG(cost_usd), 6) AS avg_cost_per_call,
    ROUND(SUM(cost_usd) * 100.0 / (SELECT SUM(cost_usd) FROM claude_code_telemetry.events WHERE event_name = 'claude_code.api_request' AND year = '$year' AND month = '$month'), 2) AS cost_share_pct
FROM claude_code_telemetry.events
WHERE event_name = 'claude_code.api_request'
  AND year = '$year' AND month = '$month'
GROUP BY model
ORDER BY total_cost DESC
```

#### Tool Analytics - 도구별 성공률

```sql
SELECT
    tool_name,
    COUNT(*) AS executions,
    SUM(CASE WHEN success = true THEN 1 ELSE 0 END) AS successes,
    SUM(CASE WHEN success = false THEN 1 ELSE 0 END) AS failures,
    ROUND(SUM(CASE WHEN success = true THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS success_rate,
    ROUND(AVG(duration_ms), 2) AS avg_duration_ms,
    ROUND(APPROX_PERCENTILE(duration_ms, 0.95), 2) AS p95_duration_ms,
    ROUND(AVG(CAST(tool_result_size_bytes AS DOUBLE)), 0) AS avg_result_bytes
FROM claude_code_telemetry.events
WHERE event_name = 'claude_code.tool_result'
  AND year = '$year' AND month = '$month'
GROUP BY tool_name
ORDER BY executions DESC
```

#### API Performance - 모델별 지연 시간 백분위수

```sql
SELECT
    model,
    COUNT(*) AS request_count,
    ROUND(APPROX_PERCENTILE(duration_ms, 0.50), 0) AS p50_ms,
    ROUND(APPROX_PERCENTILE(duration_ms, 0.90), 0) AS p90_ms,
    ROUND(APPROX_PERCENTILE(duration_ms, 0.95), 0) AS p95_ms,
    ROUND(APPROX_PERCENTILE(duration_ms, 0.99), 0) AS p99_ms,
    ROUND(AVG(duration_ms), 0) AS avg_ms,
    ROUND(MAX(duration_ms), 0) AS max_ms
FROM claude_code_telemetry.events
WHERE event_name = 'claude_code.api_request'
  AND year = '$year' AND month = '$month'
  AND duration_ms IS NOT NULL
GROUP BY model
```

#### API Performance - 캐시 효율성

```sql
SELECT
    model,
    COUNT(*) AS total_calls,
    SUM(CASE WHEN cache_read_tokens > 0 THEN 1 ELSE 0 END) AS cache_hit_calls,
    ROUND(SUM(CASE WHEN cache_read_tokens > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS cache_hit_rate_pct,
    SUM(cache_read_tokens) AS total_cache_read,
    SUM(cache_creation_tokens) AS total_cache_create,
    ROUND(SUM(cache_read_tokens) * 100.0 / NULLIF(SUM(cache_read_tokens) + SUM(cache_creation_tokens), 0), 2) AS cache_reuse_pct
FROM claude_code_telemetry.events
WHERE event_name = 'claude_code.api_request'
  AND year = '$year' AND month = '$month'
GROUP BY model
```

---

## 부록: 데이터 한계 및 권고사항

### 현재 데이터 한계

1. **단일 사용자/세션**: 52건의 데이터가 1명의 사용자, 1개 세션에서 발생했으므로 다중 사용자 환경의 비교 분석은 불가하다.
2. **커스텀 리소스 속성 미설정**: `organization_id`, `department`, `team_id`, `cost_center`가 모두 NULL이다. 이 필드들이 설정되면 조직/팀/비용센터별 분석이 가능해진다.
3. **`api_error` 이벤트 부재**: 오류 분석 대시보드는 설계하되, 현재 데이터로는 검증이 불가하다.
4. **Sonnet 캐시 미활용**: Sonnet 모델에서 캐시 토큰이 0이므로, 캐시 활용 개선 여지가 있다.

### 프로덕션 환경 권고사항

1. **OTEL_RESOURCE_ATTRIBUTES 설정 필수**: `department`, `team_id`, `cost_center`를 설정하여 조직 차원의 비용 분석을 활성화할 것.
2. **충분한 데이터 축적 후 대시보드 검증**: 최소 1주일 이상, 10명 이상의 사용자 데이터가 축적된 후 대시보드의 유효성을 검증할 것.
3. **알림 설정**: 비용 이상 탐지(Z-score > 2), API 오류율 > 5%, 도구 실패율 > 10% 등에 대한 Grafana Alert 설정을 권고한다.
