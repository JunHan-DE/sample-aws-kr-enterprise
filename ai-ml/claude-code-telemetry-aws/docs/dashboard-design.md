# Grafana 대시보드 설계 문서

## 목차

1. [개요](#1-개요)
2. [데이터 소스](#2-데이터-소스)
3. [공통 변수(필터)](#3-공통-변수필터)
4. [Dashboard 1: Overview](#4-dashboard-1-overview)
5. [Dashboard 2: Cost](#5-dashboard-2-cost)
6. [Dashboard 3: Usage](#6-dashboard-3-usage)
7. [Dashboard 4: Productivity](#7-dashboard-4-productivity)
8. [Dashboard 5: Tool Analytics](#8-dashboard-5-tool-analytics)
9. [Dashboard 6: API Performance](#9-dashboard-6-api-performance)
10. [패널 공통 규칙](#10-패널-공통-규칙)

---

## 1. 개요

Claude Code의 OpenTelemetry 데이터를 시각화하기 위한 Amazon Managed Grafana 대시보드 6종을 설계한다.

**대시보드 구성 목표**:
- 팀 리더가 조직 전체의 Claude Code 사용 현황을 한눈에 파악
- 비용 최적화를 위한 상세 비용 분석
- 개발자 생산성 지표 추적
- 도구 사용 패턴 및 API 성능 모니터링

**Grafana 그리드 시스템**: 24 컬럼 기반, 패널 높이는 임의 단위(1단위 = 약 30px)

---

## 2. 데이터 소스

| 데이터 소스 | 유형 | 저장 데이터 | 대시보드 |
|---|---|---|---|
| **AMP** (Amazon Managed Prometheus) | 시계열 메트릭 | 세션 수, 토큰 사용량, 비용, 코드 라인, 커밋, PR, 활성 시간, 도구 결정 | Overview, Cost, Usage, Productivity |
| **Athena** (S3 Parquet) | 이벤트 로그 | 사용자 프롬프트, 도구 결과, API 요청/응답, API 오류, 도구 결정 | Tool Analytics, API Performance |

---

## 3. 공통 변수(필터)

모든 대시보드에서 공유하는 템플릿 변수:

| 변수명 | 레이블 | 유형 | 소스 | 설명 |
|---|---|---|---|---|
| `$timeRange` | 기간 | 내장 | Grafana | Grafana 기본 시간 범위 선택기 |
| `$team` | 팀 | Query | AMP: `label_values(claude_code_session_total, team)` | 팀 필터 (All 포함) |
| `$user` | 사용자 | Query | AMP: `label_values(claude_code_session_total{team=~"$team"}, user)` | 사용자 필터 (All 포함) |
| `$model` | 모델 | Query | AMP: `label_values(claude_code_token_usage_total, model)` | AI 모델 필터 (Cost, Usage용) |
| `$tool` | 도구 | Query | Athena: `SELECT DISTINCT tool_name FROM tool_events` | 도구 이름 필터 (Tool Analytics용) |

---

## 4. Dashboard 1: Overview

**목적**: 전체 현황을 한눈에 파악하는 요약 대시보드

### 레이아웃 (ASCII Mockup)

```
+============================================================================+
|  [Time Range]  [Team ▼]  [User ▼]                    Overview Dashboard    |
+============================================================================+
| Row 1: 핵심 지표 (h=4)                                                     |
+------------------+------------------+------------------+------------------+
|   STAT           |   STAT           |   STAT           |   STAT           |
|   오늘 총 세션   |   오늘 총 비용   |   활성 사용자    |   오늘 총 토큰   |
|   152            |   $1,234.56      |   28             |   12.5M          |
|   ▲ 12%          |   ▲ 8%           |   ▼ 3%           |   ▲ 15%          |
|  (6 x 4)        |  (6 x 4)        |  (6 x 4)        |  (6 x 4)        |
+------------------+------------------+------------------+------------------+
| Row 2: 추세 (h=8)                                                          |
+------------------------------------+---------------------------------------+
|   TIME SERIES                      |   TIME SERIES                         |
|   세션 수 추이                     |   비용 추이                           |
|   ┌──────────────────────┐         |   ┌──────────────────────┐            |
|   │    ╱╲   ╱╲           │         |   │         ╱──          │            |
|   │   ╱  ╲ ╱  ╲──        │         |   │      ╱╱             │            |
|   │  ╱    ╲╱    ╲        │         |   │   ╱╱╱               │            |
|   │ ╱              ╲     │         |   │──╱                  │            |
|   └──────────────────────┘         |   └──────────────────────┘            |
|  (12 x 8)                         |  (12 x 8)                             |
+------------------------------------+---------------------------------------+
| Row 3: 순위 테이블 (h=8)                                                    |
+------------------------------------+---------------------------------------+
|   TABLE                            |   TABLE                               |
|   비용 상위 5 사용자               |   토큰 상위 5 사용자                 |
|   ┌──────────────────────────┐     |   ┌──────────────────────────┐        |
|   │ # | User    | Cost      │     |   │ # | User    | Tokens    │        |
|   │ 1 | alice   | $234.56   │     |   │ 1 | bob     | 3.2M      │        |
|   │ 2 | bob     | $198.23   │     |   │ 2 | alice   | 2.8M      │        |
|   │ 3 | carol   | $156.78   │     |   │ 3 | carol   | 2.1M      │        |
|   │ 4 | dave    | $134.12   │     |   │ 4 | dave    | 1.9M      │        |
|   │ 5 | eve     | $112.90   │     |   │ 5 | eve     | 1.5M      │        |
|   └──────────────────────────┘     |   └──────────────────────────┘        |
|  (12 x 8)                         |  (12 x 8)                             |
+------------------------------------+---------------------------------------+
```

### 패널 상세

| # | 패널명 | 차트 유형 | 크기 (w x h) | 데이터 소스 | 쿼리 |
|---|---|---|---|---|---|
| 1-1 | 오늘 총 세션 | Stat | 6 x 4 | AMP | `sum(increase(claude_code_session_total{team=~"$team", user=~"$user"}[1d]))` |
| 1-2 | 오늘 총 비용 | Stat | 6 x 4 | AMP | `sum(increase(claude_code_cost_dollars_total{team=~"$team", user=~"$user"}[1d]))` |
| 1-3 | 활성 사용자 | Stat | 6 x 4 | AMP | `count(count by (user)(increase(claude_code_session_total{team=~"$team", user=~"$user"}[1d]) > 0))` |
| 1-4 | 오늘 총 토큰 | Stat | 6 x 4 | AMP | `sum(increase(claude_code_token_usage_total{team=~"$team", user=~"$user"}[1d]))` |
| 2-1 | 세션 수 추이 | Time Series | 12 x 8 | AMP | `sum(rate(claude_code_session_total{team=~"$team", user=~"$user"}[$__rate_interval]))` |
| 2-2 | 비용 추이 | Time Series | 12 x 8 | AMP | `sum(rate(claude_code_cost_dollars_total{team=~"$team", user=~"$user"}[$__rate_interval]))` |
| 3-1 | 비용 상위 5 사용자 | Table | 12 x 8 | AMP | `topk(5, sum by (user)(increase(claude_code_cost_dollars_total{team=~"$team"}[$__range])))` |
| 3-2 | 토큰 상위 5 사용자 | Table | 12 x 8 | AMP | `topk(5, sum by (user)(increase(claude_code_token_usage_total{team=~"$team"}[$__range])))` |

**Stat 패널 옵션**:
- Color mode: Background gradient
- Graph mode: Area (스파크라인 표시)
- 전일 대비 변화율 표시 (Reduce: Last, Calc: Diff percent)

---

## 5. Dashboard 2: Cost

**목적**: 비용 추세와 분포를 상세 분석하여 비용 최적화 인사이트 제공

### 레이아웃 (ASCII Mockup)

```
+============================================================================+
|  [Time Range]  [Team ▼]  [User ▼]  [Model ▼]           Cost Dashboard     |
+============================================================================+
| Row 1: 핵심 비용 지표 (h=4)                                                |
+----------------+----------------+----------------+                         |
|   STAT         |   STAT         |   STAT         |                         |
|   총 비용      |   세션당 평균  |   전일 대비    |                         |
|   $1,234.56    |   $8.12        |   ▲ +$123.45   |                         |
|                |                |   (+11.1%)     |                         |
|  (8 x 4)      |  (8 x 4)      |  (8 x 4)      |                         |
+----------------+----------------+----------------+-------------------------+
| Row 2: 비용 추세 (h=8)                                                     |
+------------------------------------+---------------------------------------+
|   TIME SERIES                      |   TIME SERIES (Stacked)               |
|   일별 비용 추이                   |   모델별 비용 추이                   |
|   ┌──────────────────────┐         |   ┌──────────────────────┐            |
|   │         ╱──╲         │         |   │ ████████████████████ │ opus       |
|   │      ╱╱╱    ╲╲       │         |   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓     │ sonnet     |
|   │   ╱╱╱         ╲╲     │         |   │ ░░░░░░░░░           │ haiku      |
|   │──╱               ╲   │         |   │                     │            |
|   └──────────────────────┘         |   └──────────────────────┘            |
|  (12 x 8)                         |  (12 x 8)                             |
+------------------------------------+---------------------------------------+
| Row 3: 비용 분포 (h=8)                                                     |
+------------------------------------+---------------------------------------+
|   BAR CHART (Horizontal)           |   BAR CHART (Horizontal)              |
|   팀별 비용                        |   사용자별 비용 (Top 10)             |
|   ┌──────────────────────┐         |   ┌──────────────────────┐            |
|   │ Team-A  ████████████ │         |   │ alice  █████████████ │            |
|   │ Team-B  ████████     │         |   │ bob    ███████████   │            |
|   │ Team-C  ██████       │         |   │ carol  █████████     │            |
|   │ Team-D  ████         │         |   │ dave   ███████       │            |
|   └──────────────────────┘         |   │ ...    ...           │            |
|  (12 x 8)                         |   └──────────────────────┘            |
|                                    |  (12 x 8)                             |
+------------------------------------+---------------------------------------+
| Row 4: 상세 테이블 (h=8)                                                    |
+============================================================================+
|   TABLE                                                                     |
|   사용자/세션별 비용 상세                                                   |
|   ┌────────────────────────────────────────────────────────────────────┐    |
|   │ User    | Team   | Sessions | Tokens     | Cost    | Avg/Session  │    |
|   │ alice   | Team-A | 45       | 3,200,000  | $234.56 | $5.21        │    |
|   │ bob     | Team-A | 38       | 2,800,000  | $198.23 | $5.22        │    |
|   │ carol   | Team-B | 32       | 2,100,000  | $156.78 | $4.90        │    |
|   └────────────────────────────────────────────────────────────────────┘    |
|  (24 x 8)                                                                  |
+============================================================================+
```

### 패널 상세

| # | 패널명 | 차트 유형 | 크기 (w x h) | 데이터 소스 | 쿼리 |
|---|---|---|---|---|---|
| 1-1 | 총 비용 | Stat | 8 x 4 | AMP | `sum(increase(claude_code_cost_dollars_total{team=~"$team", user=~"$user", model=~"$model"}[$__range]))` |
| 1-2 | 세션당 평균 비용 | Stat | 8 x 4 | AMP | `sum(increase(claude_code_cost_dollars_total{team=~"$team", user=~"$user", model=~"$model"}[$__range])) / sum(increase(claude_code_session_total{team=~"$team", user=~"$user"}[$__range]))` |
| 1-3 | 전일 대비 변화 | Stat | 8 x 4 | AMP | `sum(increase(claude_code_cost_dollars_total{team=~"$team", user=~"$user"}[1d])) - sum(increase(claude_code_cost_dollars_total{team=~"$team", user=~"$user"}[1d] offset 1d))` |
| 2-1 | 일별 비용 추이 | Time Series | 12 x 8 | AMP | `sum(increase(claude_code_cost_dollars_total{team=~"$team", user=~"$user", model=~"$model"}[1d]))` |
| 2-2 | 모델별 비용 추이 | Time Series (Stacked) | 12 x 8 | AMP | `sum by (model)(increase(claude_code_cost_dollars_total{team=~"$team", user=~"$user", model=~"$model"}[1d]))` |
| 3-1 | 팀별 비용 | Bar Chart | 12 x 8 | AMP | `sum by (team)(increase(claude_code_cost_dollars_total{team=~"$team", model=~"$model"}[$__range]))` |
| 3-2 | 사용자별 비용 Top 10 | Bar Chart | 12 x 8 | AMP | `topk(10, sum by (user)(increase(claude_code_cost_dollars_total{team=~"$team", model=~"$model"}[$__range])))` |
| 4-1 | 비용 상세 테이블 | Table | 24 x 8 | AMP | `sum by (user, team)(increase(claude_code_cost_dollars_total{team=~"$team", user=~"$user", model=~"$model"}[$__range]))` + Transform: Merge with session count, token count |

**비용 Stat 패널 옵션**:
- 총 비용: Unit = Currency (USD), Color = Green/Yellow/Red 임계값 ($500/$1000)
- 전일 대비: 양수 = 빨강(비용 증가 경고), 음수 = 초록(비용 감소 긍정)

---

## 6. Dashboard 3: Usage

**목적**: 토큰 사용량, 세션 패턴, 캐시 효율성 분석

### 레이아웃 (ASCII Mockup)

```
+============================================================================+
|  [Time Range]  [Team ▼]  [User ▼]  [Model ▼]           Usage Dashboard    |
+============================================================================+
| Row 1: 핵심 사용량 지표 (h=4)                                              |
+------------+------------+------------+------------+                        |
|  STAT      |  STAT      |  STAT      |  GAUGE     |                        |
|  총 토큰   |  Input/    |  캐시      |  오늘      |                        |
|            |  Output    |  히트율    |  활성 시간 |                        |
|  12.5M     |  비율 3:1  |  62%       |  ████░ 6h  |                        |
|  (6 x 4)  |  (6 x 4)  |  (6 x 4)  |  (6 x 4)  |                        |
+------------+------------+------------+------------+------------------------+
| Row 2: 토큰 사용량 추이 (h=8)                                              |
+============================================================================+
|   TIME SERIES (Stacked Area)                                                |
|   토큰 유형별 사용량 추이                                                  |
|   ┌────────────────────────────────────────────────────────────────────┐    |
|   │ ████████████████████████████████████████████████████ cacheRead    │    |
|   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓               input        │    |
|   │ ░░░░░░░░░░░░░░░░░░░░░░░░░                          output       │    |
|   │ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒                                  cacheCreation│    |
|   └────────────────────────────────────────────────────────────────────┘    |
|  (24 x 8)                                                                  |
+============================================================================+
| Row 3: 세션 분포 (h=8)                                                     |
+------------------------------------+---------------------------------------+
|   BAR CHART                        |   BAR CHART                           |
|   터미널 유형별 세션               |   사용자별 세션 수                   |
|   ┌──────────────────────┐         |   ┌──────────────────────┐            |
|   │ VS Code █████████████│         |   │ alice █████████████  │            |
|   │ Terminal ████████    │         |   │ bob   ███████████    │            |
|   │ iTerm2  ██████       │         |   │ carol █████████      │            |
|   │ JetBrains ████       │         |   │ dave  ███████        │            |
|   │ Other   ██           │         |   │ eve   █████          │            |
|   └──────────────────────┘         |   └──────────────────────┘            |
|  (12 x 8)                         |  (12 x 8)                             |
+------------------------------------+---------------------------------------+
```

### 패널 상세

| # | 패널명 | 차트 유형 | 크기 (w x h) | 데이터 소스 | 쿼리 |
|---|---|---|---|---|---|
| 1-1 | 총 토큰 | Stat | 6 x 4 | AMP | `sum(increase(claude_code_token_usage_total{team=~"$team", user=~"$user", model=~"$model"}[$__range]))` |
| 1-2 | Input/Output 비율 | Stat | 6 x 4 | AMP | `sum(increase(claude_code_token_usage_total{team=~"$team", user=~"$user", type="input"}[$__range])) / sum(increase(claude_code_token_usage_total{team=~"$team", user=~"$user", type="output"}[$__range]))` |
| 1-3 | 캐시 히트율 | Stat | 6 x 4 | AMP | `sum(increase(claude_code_token_usage_total{team=~"$team", user=~"$user", type="cacheRead"}[$__range])) / (sum(increase(claude_code_token_usage_total{team=~"$team", user=~"$user", type="cacheRead"}[$__range])) + sum(increase(claude_code_token_usage_total{team=~"$team", user=~"$user", type="cacheCreation"}[$__range]))) * 100` |
| 1-4 | 오늘 활성 시간 | Gauge | 6 x 4 | AMP | `sum(increase(claude_code_active_time_seconds_total{team=~"$team", user=~"$user"}[1d])) / 3600` |
| 2-1 | 토큰 유형별 추이 | Time Series (Stacked Area) | 24 x 8 | AMP | `sum by (type)(rate(claude_code_token_usage_total{team=~"$team", user=~"$user", model=~"$model"}[$__rate_interval]))` |
| 3-1 | 터미널 유형별 세션 | Bar Chart | 12 x 8 | AMP | `sum by (terminal)(increase(claude_code_session_total{team=~"$team", user=~"$user"}[$__range]))` |
| 3-2 | 사용자별 세션 수 | Bar Chart | 12 x 8 | AMP | `topk(10, sum by (user)(increase(claude_code_session_total{team=~"$team"}[$__range])))` |

**Gauge 패널 옵션**:
- Min: 0, Max: 24 (시간)
- 임계값: 초록(0-4h), 노랑(4-8h), 빨강(8h+)
- Unit: hours

**캐시 히트율 Stat 옵션**:
- Unit: Percent (0-100)
- 임계값: 빨강(0-30%), 노랑(30-60%), 초록(60-100%)

---

## 7. Dashboard 4: Productivity

**목적**: 개발자 생산성 지표(커밋, PR, 코드 변경량) 추적

### 레이아웃 (ASCII Mockup)

```
+============================================================================+
|  [Time Range]  [Team ▼]  [User ▼]                Productivity Dashboard    |
+============================================================================+
| Row 1: 핵심 생산성 지표 (h=4)                                              |
+------------+------------+------------+------------+                        |
|  STAT      |  STAT      |  STAT      |  STAT      |                        |
|  총 커밋   |  총 PR     |  추가 라인 |  삭제 라인 |                        |
|  328       |  45        |  12,456    |  3,210     |                        |
|  ▲ 15%     |  ▲ 8%      |            |            |                        |
|  (6 x 4)  |  (6 x 4)  |  (6 x 4)  |  (6 x 4)  |                        |
+------------+------------+------------+------------+------------------------+
| Row 2: 추이 (h=8)                                                          |
+------------------------------------+---------------------------------------+
|   TIME SERIES                      |   TIME SERIES                         |
|   커밋 수 추이                     |   PR 수 추이                         |
|   ┌──────────────────────┐         |   ┌──────────────────────┐            |
|   │  ╱╲    ╱╲            │         |   │        ╱╲             │            |
|   │ ╱  ╲  ╱  ╲──╲        │         |   │  ╱╲  ╱  ╲──          │            |
|   │╱    ╲╱      ╲       │         |   │ ╱  ╲╱                │            |
|   │                ╲     │         |   │╱                     │            |
|   └──────────────────────┘         |   └──────────────────────┘            |
|  (12 x 8)                         |  (12 x 8)                             |
+------------------------------------+---------------------------------------+
| Row 3: 사용자별 분포 (h=8)                                                  |
+------------------------------------+---------------------------------------+
|   BAR CHART                        |   BAR CHART                           |
|   사용자별 코드 라인               |   사용자별 커밋 수                   |
|   ┌──────────────────────┐         |   ┌──────────────────────┐            |
|   │ alice ██████ (+)     │         |   │ alice ████████████   │            |
|   │       ███   (-)      │         |   │ bob   ██████████     │            |
|   │ bob   █████  (+)     │         |   │ carol ████████       │            |
|   │       ████   (-)     │         |   │ dave  ██████         │            |
|   │ carol ████   (+)     │         |   │ eve   ████           │            |
|   │       ██     (-)     │         |   └──────────────────────┘            |
|   └──────────────────────┘         |  (12 x 8)                             |
|  (12 x 8)                         |                                        |
+------------------------------------+---------------------------------------+
| Row 4: 추가/삭제 비율 추이 (h=8)                                           |
+============================================================================+
|   TIME SERIES (Dual Axis)                                                   |
|   코드 라인 추가 vs 삭제 추이                                              |
|   ┌────────────────────────────────────────────────────────────────────┐    |
|   │ ████████████████████████████████████████████  Lines Added (초록)  │    |
|   │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░              Lines Removed (빨강) │    |
|   │                                                                    │    |
|   │ ── Ratio (우축) ──────────────────                                 │    |
|   └────────────────────────────────────────────────────────────────────┘    |
|  (24 x 8)                                                                  |
+============================================================================+
```

### 패널 상세

| # | 패널명 | 차트 유형 | 크기 (w x h) | 데이터 소스 | 쿼리 |
|---|---|---|---|---|---|
| 1-1 | 총 커밋 | Stat | 6 x 4 | AMP | `sum(increase(claude_code_commits_total{team=~"$team", user=~"$user"}[$__range]))` |
| 1-2 | 총 PR | Stat | 6 x 4 | AMP | `sum(increase(claude_code_pull_requests_total{team=~"$team", user=~"$user"}[$__range]))` |
| 1-3 | 추가 라인 | Stat | 6 x 4 | AMP | `sum(increase(claude_code_lines_added_total{team=~"$team", user=~"$user"}[$__range]))` |
| 1-4 | 삭제 라인 | Stat | 6 x 4 | AMP | `sum(increase(claude_code_lines_removed_total{team=~"$team", user=~"$user"}[$__range]))` |
| 2-1 | 커밋 수 추이 | Time Series | 12 x 8 | AMP | `sum(increase(claude_code_commits_total{team=~"$team", user=~"$user"}[1h]))` |
| 2-2 | PR 수 추이 | Time Series | 12 x 8 | AMP | `sum(increase(claude_code_pull_requests_total{team=~"$team", user=~"$user"}[1h]))` |
| 3-1 | 사용자별 코드 라인 | Bar Chart (Grouped) | 12 x 8 | AMP | Added: `sum by (user)(increase(claude_code_lines_added_total{team=~"$team"}[$__range]))` / Removed: `sum by (user)(increase(claude_code_lines_removed_total{team=~"$team"}[$__range]))` |
| 3-2 | 사용자별 커밋 수 | Bar Chart | 12 x 8 | AMP | `topk(10, sum by (user)(increase(claude_code_commits_total{team=~"$team"}[$__range])))` |
| 4-1 | 추가/삭제 비율 추이 | Time Series (Dual Axis) | 24 x 8 | AMP | 좌축: `sum(increase(claude_code_lines_added_total{team=~"$team", user=~"$user"}[1d]))`, `sum(increase(claude_code_lines_removed_total{team=~"$team", user=~"$user"}[1d]))` / 우축(비율): `sum(increase(claude_code_lines_added_total[1d])) / sum(increase(claude_code_lines_removed_total[1d]))` |

**Stat 패널 옵션**:
- 커밋/PR: Graph mode = Area, Color = Blue
- 추가 라인: Color = Green
- 삭제 라인: Color = Red

---

## 8. Dashboard 5: Tool Analytics

**목적**: Claude Code 도구(Tool) 사용 패턴, 성공/실패율, 실행 시간 분석

> **데이터 소스: Athena** (S3 Parquet 이벤트 로그 기반)

### 레이아웃 (ASCII Mockup)

```
+============================================================================+
|  [Time Range]  [Team ▼]  [Tool ▼]              Tool Analytics Dashboard    |
+============================================================================+
| Row 1: 도구 사용 빈도 + 성공/실패율 (h=8)                                 |
+------------------------------+---------------------------------------------+
|   BAR CHART (Horizontal)     |   PIE CHART                                 |
|   도구 사용 빈도             |   도구 성공/실패율                          |
|   ┌────────────────────┐     |   ┌──────────────────────────┐               |
|   │ Read    ███████████│     |   │         ╭───────╮        │               |
|   │ Edit    █████████  │     |   │      ╭──╯       ╰──╮     │               |
|   │ Bash    ████████   │     |   │    ╭─╯   Success   ╰─╮   │               |
|   │ Write   ██████     │     |   │    │     92.3%       │   │               |
|   │ Grep    █████      │     |   │    ╰─╮             ╭─╯   │               |
|   │ Glob    ████       │     |   │      ╰──╮  Fail  ╭──╯    │               |
|   │ WebFetch ███       │     |   │         ╰───────╯        │               |
|   │ Task    ██         │     |   │          7.7%            │               |
|   └────────────────────┘     |   └──────────────────────────┘               |
|  (12 x 8)                   |  (12 x 8)                                    |
+------------------------------+---------------------------------------------+
| Row 2: 실행 시간 추이 (h=8)                                                |
+============================================================================+
|   TIME SERIES                                                               |
|   도구별 평균 실행 시간 추이 (ms)                                          |
|   ┌────────────────────────────────────────────────────────────────────┐    |
|   │ ─── Bash (높음)                                                    │    |
|   │ ─── WebFetch (중간)                                                │    |
|   │ ─── Read (낮음)                                                    │    |
|   │ ─── Edit (낮음)                                                    │    |
|   └────────────────────────────────────────────────────────────────────┘    |
|  (24 x 8)                                                                  |
+============================================================================+
| Row 3: 오류 테이블 + 히트맵 (h=8)                                          |
+------------------------------------------+---------------------------------+
|   TABLE                                  |   HEATMAP                       |
|   최근 도구 오류                         |   시간대별 도구 사용량          |
|   ┌────────────────────────────────┐     |   ┌─────────────────────────┐   |
|   │ Time  | Tool   | Error        │     |   │     0  4  8  12 16 20   │   |
|   │ 14:23 | Bash   | exit code 1  │     |   │ Mon ░░ ░░ ██ ██ ██ ░░  │   |
|   │ 14:15 | Edit   | not unique   │     |   │ Tue ░░ ░░ ██ ██ ██ ░░  │   |
|   │ 13:58 | WebF.. | timeout      │     |   │ Wed ░░ ░░ ██ ██ ██ ░░  │   |
|   │ 13:42 | Bash   | permission   │     |   │ Thu ░░ ░░ ██ ██ ██ ░░  │   |
|   │ 13:30 | Write  | read-only    │     |   │ Fri ░░ ░░ ██ ██ ██ ░░  │   |
|   └────────────────────────────────┘     |   └─────────────────────────┘   |
|  (14 x 8)                               |  (10 x 8)                       |
+------------------------------------------+---------------------------------+
```

### 패널 상세

| # | 패널명 | 차트 유형 | 크기 (w x h) | 데이터 소스 | 쿼리 |
|---|---|---|---|---|---|
| 1-1 | 도구 사용 빈도 | Bar Chart (Horizontal) | 12 x 8 | Athena | 아래 SQL 참조 |
| 1-2 | 도구 성공/실패율 | Pie Chart | 12 x 8 | Athena | 아래 SQL 참조 |
| 2-1 | 평균 실행 시간 추이 | Time Series | 24 x 8 | Athena | 아래 SQL 참조 |
| 3-1 | 최근 도구 오류 | Table | 14 x 8 | Athena | 아래 SQL 참조 |
| 3-2 | 시간대별 도구 사용 히트맵 | Heatmap | 10 x 8 | Athena | 아래 SQL 참조 |

### SQL 쿼리

**1-1: 도구 사용 빈도**
```sql
SELECT
  tool_name,
  COUNT(*) AS usage_count
FROM tool_events
WHERE timestamp BETWEEN $__timeFrom() AND $__timeTo()
  AND team IN ($team)
  AND tool_name IN ($tool)
GROUP BY tool_name
ORDER BY usage_count DESC
LIMIT 20
```

**1-2: 도구 성공/실패율**
```sql
SELECT
  CASE WHEN is_error = true THEN 'Failure' ELSE 'Success' END AS status,
  COUNT(*) AS count
FROM tool_events
WHERE timestamp BETWEEN $__timeFrom() AND $__timeTo()
  AND team IN ($team)
  AND tool_name IN ($tool)
GROUP BY is_error
```

**2-1: 평균 실행 시간 추이**
```sql
SELECT
  date_trunc('hour', timestamp) AS time,
  tool_name,
  AVG(duration_ms) AS avg_duration_ms
FROM tool_events
WHERE timestamp BETWEEN $__timeFrom() AND $__timeTo()
  AND team IN ($team)
  AND tool_name IN ($tool)
GROUP BY 1, 2
ORDER BY 1
```

**3-1: 최근 도구 오류**
```sql
SELECT
  timestamp,
  tool_name,
  user,
  error_message,
  session_id
FROM tool_events
WHERE timestamp BETWEEN $__timeFrom() AND $__timeTo()
  AND is_error = true
  AND team IN ($team)
  AND tool_name IN ($tool)
ORDER BY timestamp DESC
LIMIT 50
```

**3-2: 시간대별 도구 사용 히트맵**
```sql
SELECT
  day_of_week(timestamp) AS day_of_week,
  hour(timestamp) AS hour_of_day,
  COUNT(*) AS usage_count
FROM tool_events
WHERE timestamp BETWEEN $__timeFrom() AND $__timeTo()
  AND team IN ($team)
  AND tool_name IN ($tool)
GROUP BY 1, 2
ORDER BY 1, 2
```

**Heatmap 패널 옵션**:
- X축: 시간 (0-23)
- Y축: 요일 (Mon-Fri)
- Color scheme: Green to Red (사용량 기준)

---

## 9. Dashboard 6: API Performance

**목적**: Claude API 호출 지연시간, 오류율, 성능 모니터링

> **데이터 소스: Athena** (S3 Parquet 이벤트 로그 기반)

### 레이아웃 (ASCII Mockup)

```
+============================================================================+
|  [Time Range]  [Model ▼]                     API Performance Dashboard     |
+============================================================================+
| Row 1: 핵심 API 지표 (h=4)                                                |
+----------------+----------------+----------------+                         |
|   STAT         |   STAT         |   STAT         |                         |
|   평균 응답    |   오류율       |   총 API 호출  |                         |
|   시간         |                |                |                         |
|   1.23s        |   2.4%         |   45,678       |                         |
|   ▼ -0.15s     |   ▲ +0.3%      |                |                         |
|  (8 x 4)      |  (8 x 4)      |  (8 x 4)      |                         |
+----------------+----------------+----------------+-------------------------+
| Row 2: 지연시간 추이 (h=8)                                                 |
+============================================================================+
|   TIME SERIES                                                               |
|   API 지연시간 백분위수 (p50, p90, p99)                                    |
|   ┌────────────────────────────────────────────────────────────────────┐    |
|   │ ─── p99 (빨강)  ────────────────────────────── 4.2s               │    |
|   │                                                                    │    |
|   │ ─── p90 (노랑)  ────────────────────────────── 2.1s               │    |
|   │                                                                    │    |
|   │ ─── p50 (초록)  ────────────────────────────── 0.8s               │    |
|   └────────────────────────────────────────────────────────────────────┘    |
|  (24 x 8)                                                                  |
+============================================================================+
| Row 3: 오류 분석 (h=8)                                                     |
+------------------------------------+---------------------------------------+
|   BAR CHART                        |   BAR CHART                           |
|   상태 코드별 오류                 |   모델별 오류                        |
|   ┌──────────────────────┐         |   ┌──────────────────────┐            |
|   │ 429 █████████████████│         |   │ opus   █████████████ │            |
|   │ 500 ██████████       │         |   │ sonnet ███████       │            |
|   │ 503 ████████         │         |   │ haiku  ████          │            |
|   │ 401 ███              │         |   │                      │            |
|   │ 403 ██               │         |   │                      │            |
|   └──────────────────────┘         |   └──────────────────────┘            |
|  (12 x 8)                         |  (12 x 8)                             |
+------------------------------------+---------------------------------------+
| Row 4: 최근 API 오류 상세 (h=8)                                            |
+============================================================================+
|   TABLE                                                                     |
|   최근 API 오류 상세                                                       |
|   ┌────────────────────────────────────────────────────────────────────┐    |
|   │ Time  | Model  | Status | Error Type     | User   | Session      │    |
|   │ 14:23 | opus   | 429    | rate_limit     | alice  | ses_abc123   │    |
|   │ 14:15 | sonnet | 500    | internal_error | bob    | ses_def456   │    |
|   │ 13:58 | opus   | 529    | overloaded     | carol  | ses_ghi789   │    |
|   │ 13:42 | haiku  | 429    | rate_limit     | dave   | ses_jkl012   │    |
|   └────────────────────────────────────────────────────────────────────┘    |
|  (24 x 8)                                                                  |
+============================================================================+
```

### 패널 상세

| # | 패널명 | 차트 유형 | 크기 (w x h) | 데이터 소스 | 쿼리 |
|---|---|---|---|---|---|
| 1-1 | 평균 응답 시간 | Stat | 8 x 4 | Athena | 아래 SQL 참조 |
| 1-2 | 오류율 | Stat | 8 x 4 | Athena | 아래 SQL 참조 |
| 1-3 | 총 API 호출 | Stat | 8 x 4 | Athena | 아래 SQL 참조 |
| 2-1 | API 지연시간 백분위수 | Time Series | 24 x 8 | Athena | 아래 SQL 참조 |
| 3-1 | 상태 코드별 오류 | Bar Chart | 12 x 8 | Athena | 아래 SQL 참조 |
| 3-2 | 모델별 오류 | Bar Chart | 12 x 8 | Athena | 아래 SQL 참조 |
| 4-1 | 최근 API 오류 상세 | Table | 24 x 8 | Athena | 아래 SQL 참조 |

### SQL 쿼리

**1-1: 평균 응답 시간**
```sql
SELECT
  AVG(response_time_ms) / 1000.0 AS avg_response_time_seconds
FROM api_events
WHERE timestamp BETWEEN $__timeFrom() AND $__timeTo()
  AND model IN ($model)
```

**1-2: 오류율**
```sql
SELECT
  CAST(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS DOUBLE)
  / CAST(COUNT(*) AS DOUBLE) * 100 AS error_rate_percent
FROM api_events
WHERE timestamp BETWEEN $__timeFrom() AND $__timeTo()
  AND model IN ($model)
```

**1-3: 총 API 호출**
```sql
SELECT
  COUNT(*) AS total_api_calls
FROM api_events
WHERE timestamp BETWEEN $__timeFrom() AND $__timeTo()
  AND model IN ($model)
```

**2-1: API 지연시간 백분위수**
```sql
SELECT
  date_trunc('hour', timestamp) AS time,
  approx_percentile(response_time_ms, 0.50) / 1000.0 AS p50_seconds,
  approx_percentile(response_time_ms, 0.90) / 1000.0 AS p90_seconds,
  approx_percentile(response_time_ms, 0.99) / 1000.0 AS p99_seconds
FROM api_events
WHERE timestamp BETWEEN $__timeFrom() AND $__timeTo()
  AND model IN ($model)
GROUP BY 1
ORDER BY 1
```

**3-1: 상태 코드별 오류**
```sql
SELECT
  CAST(status_code AS VARCHAR) AS status_code,
  COUNT(*) AS error_count
FROM api_events
WHERE timestamp BETWEEN $__timeFrom() AND $__timeTo()
  AND status_code >= 400
  AND model IN ($model)
GROUP BY status_code
ORDER BY error_count DESC
```

**3-2: 모델별 오류**
```sql
SELECT
  model,
  COUNT(*) AS error_count
FROM api_events
WHERE timestamp BETWEEN $__timeFrom() AND $__timeTo()
  AND status_code >= 400
  AND model IN ($model)
GROUP BY model
ORDER BY error_count DESC
```

**4-1: 최근 API 오류 상세**
```sql
SELECT
  timestamp,
  model,
  status_code,
  error_type,
  error_message,
  user,
  session_id
FROM api_events
WHERE timestamp BETWEEN $__timeFrom() AND $__timeTo()
  AND status_code >= 400
  AND model IN ($model)
ORDER BY timestamp DESC
LIMIT 100
```

**Stat 패널 옵션**:
- 평균 응답 시간: Unit = seconds, 임계값: 초록(<2s), 노랑(2-5s), 빨강(>5s)
- 오류율: Unit = percent, 임계값: 초록(<1%), 노랑(1-5%), 빨강(>5%)

---

## 10. 패널 공통 규칙

### 색상 체계

| 용도 | 색상 | Grafana Theme |
|---|---|---|
| 성공/긍정 지표 | 초록 | `green` |
| 경고/주의 | 노랑 | `yellow` |
| 오류/위험 | 빨강 | `red` |
| 주요 데이터 | 파랑 | `blue` |
| 보조 데이터 | 보라 | `purple` |
| 중립 | 회색 | `gray` |

### 공통 Stat 패널 설정

```
- Orientation: Horizontal
- Color mode: Background gradient
- Graph mode: Area (스파크라인)
- Text mode: Value and name
- Reduce: Last (현재값) 또는 Sum (합계)
```

### 공통 Time Series 설정

```
- Legend: Bottom, Table mode
- Tooltip: All series
- Fill opacity: 10 (단일 라인), 80 (스택)
- Point size: 5
- Line width: 2
```

### 공통 Table 설정

```
- Pagination: 활성화 (25 rows/page)
- Column sorting: 활성화
- Column filtering: 활성화
- Footer: Sum 또는 Avg (숫자 컬럼)
```

### 공통 Bar Chart 설정

```
- Orientation: Horizontal (순위 표시), Vertical (시간 비교)
- Show values: Always
- Bar width: 0.7
- Color: By series
```

### 반응형 레이아웃 규칙

| 화면 너비 | 패널 배치 |
|---|---|
| Desktop (> 1600px) | 설계대로 (24-column grid) |
| Tablet (1024-1600px) | 12-column 이하 패널은 풀 너비 |
| Mobile (< 1024px) | 모든 패널 풀 너비 (24 x h) |

### 대시보드 네비게이션

```
+------------------------------------------------------------------+
|  [Overview] | [Cost] | [Usage] | [Productivity] | [Tools] | [API] |
+------------------------------------------------------------------+
```

- 상단 네비게이션 바를 통해 6개 대시보드 간 빠른 이동
- Grafana의 Dashboard Links 기능 사용
- 각 대시보드에서 다른 대시보드로의 drill-down 링크 제공

### Drill-Down 연계

| 소스 대시보드 | 클릭 대상 | 이동 대상 | 전달 변수 |
|---|---|---|---|
| Overview | 비용 상위 사용자 테이블의 행 | Cost Dashboard | `$user = 선택된 사용자` |
| Overview | 토큰 상위 사용자 테이블의 행 | Usage Dashboard | `$user = 선택된 사용자` |
| Cost | 모델별 비용 시리즈 클릭 | Usage Dashboard | `$model = 선택된 모델` |
| Usage | 사용자별 세션 바 클릭 | Productivity Dashboard | `$user = 선택된 사용자` |
| Tool Analytics | 오류 테이블의 세션 ID 클릭 | API Performance | 세션 필터 |

---

## 부록: 메트릭 이름 참조

### AMP (Prometheus) 메트릭

| 메트릭명 | 유형 | 레이블 | 설명 |
|---|---|---|---|
| `claude_code_session_total` | Counter | team, user, terminal | 총 세션 수 |
| `claude_code_cost_dollars_total` | Counter | team, user, model | 누적 비용 (USD) |
| `claude_code_token_usage_total` | Counter | team, user, model, type | 토큰 사용량 (type: input/output/cacheRead/cacheCreation) |
| `claude_code_active_time_seconds_total` | Counter | team, user | 활성 사용 시간 (초) |
| `claude_code_commits_total` | Counter | team, user | 커밋 수 |
| `claude_code_pull_requests_total` | Counter | team, user | PR 수 |
| `claude_code_lines_added_total` | Counter | team, user | 추가된 코드 라인 |
| `claude_code_lines_removed_total` | Counter | team, user | 삭제된 코드 라인 |

### Athena 테이블

| 테이블명 | 주요 컬럼 | 설명 |
|---|---|---|
| `tool_events` | timestamp, session_id, user, team, tool_name, is_error, error_message, duration_ms | 도구 실행 이벤트 |
| `api_events` | timestamp, session_id, user, team, model, status_code, error_type, error_message, response_time_ms | API 호출 이벤트 |
