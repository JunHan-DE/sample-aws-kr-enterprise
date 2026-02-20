> **참고**: 이 문서는 설계 산출물(design artifact)입니다. 대시보드 중복 제거 작업의 분석 근거로 사용되었으며, 최종 대시보드 구조는 `docs/dashboard-guide.md`를 참조하세요.

# Dashboard Overlap Analysis: Athena vs Prometheus

## Summary

This document catalogs every panel across all 6 dashboards and classifies each as:

- **DUPLICATE**: The same metric/aggregation is available from Prometheus counters. These should be REMOVED from Athena dashboards.
- **ATHENA-ONLY**: Requires event-level detail (joins across event types, drill-down, per-request fields like `duration_ms`, `error`, `speed`, `prompt_length`, `tool_result_size_bytes`, `status_code`, `attempt`, `source`) that Prometheus counters cannot provide.
- **PROMETHEUS-ONLY**: Only available in the Prometheus real-time dashboard (metrics that have no Athena event equivalent).

### Prometheus Metrics Reference

| Metric | Labels |
|--------|--------|
| `claude_code_session_count_total` | session_id, user_id, user_name, organization_id, terminal_type, service_version, os_type, host_arch |
| `claude_code_cost_usage_USD_total` | model + standard labels |
| `claude_code_token_usage_tokens_total` | type (input/output/cacheRead/cacheCreation), model + standard labels |
| `claude_code_active_time_seconds_total` | type (user/cli) + standard labels |
| `claude_code_lines_of_code_count_total` | type (added/removed) + standard labels |
| `claude_code_commit_count_total` | standard labels |
| `claude_code_pull_request_count_total` | standard labels |
| `claude_code_code_edit_tool_decision_total` | decision, tool_name, language + standard labels |

---

## 1. Overview Dashboard (`overview.json`) -- Athena

| Panel ID | Panel Title | Classification | Reasoning |
|----------|-------------|----------------|-----------|
| 1 | Total Sessions | **DUPLICATE** | `COUNT(DISTINCT session_id)` -- Prometheus `claude_code_session_count_total` provides the same total. |
| 2 | Active Users | **DUPLICATE** | `COUNT(DISTINCT user_id)` -- Prometheus `claude_code_session_count_total` has `user_id` label; `count(count by (user_id) (claude_code_session_count_total))` gives unique users. |
| 3 | Total Cost (USD) | **DUPLICATE** | `SUM(cost_usd)` -- Prometheus `claude_code_cost_usage_USD_total` provides the same. |
| 4 | Total Tokens | **DUPLICATE** | `SUM(input_tokens + output_tokens + cache_read + cache_creation)` -- Prometheus `claude_code_token_usage_tokens_total` (sum all types) provides the same. |
| 5 | Avg Session Cost | **DUPLICATE** | `SUM(cost) / COUNT(DISTINCT session_id)` -- Both cost and session count are in Prometheus; computable as ratio. |
| 6 | Daily Activity Trend | **DUPLICATE** | Hourly events/sessions/users over time -- Prometheus `rate(session_count_total)` and `rate(cost_usage)` cover sessions and activity trends. Event count per hour is approximated by session rate. |
| 7 | Cost Trend by Model (Stacked) | **DUPLICATE** | Hourly cost by model -- Prometheus `rate(claude_code_cost_usage_USD_total)` by model provides identical time series. |
| 8 | Model Cost Share | **DUPLICATE** | Cost by model pie chart -- Prometheus `increase(claude_code_cost_usage_USD_total)` by model gives the same distribution. |
| 9 | Event Distribution | **ATHENA-ONLY** | `COUNT(*)` grouped by `event_name` -- Prometheus has no event-type-level counter. Requires Athena event-level data to distinguish api_request, tool_result, user_prompt, etc. |
| 10 | Session Complexity Overview | **ATHENA-ONLY** | Cross-event join per session: prompts, api_calls, tool_uses, cost, duration -- Requires correlating multiple event types within a session. Prometheus counters cannot provide per-session cross-event breakdown. |
| 11 | Top 10 Users by Cost | **DUPLICATE** | `SUM(cost_usd)` grouped by user -- Prometheus `increase(claude_code_cost_usage_USD_total)` by `user_id`/`user_name` provides the same ranking. |
| 12 | Top 10 Users by Tokens | **DUPLICATE** | `SUM(tokens)` grouped by user -- Prometheus `increase(claude_code_token_usage_tokens_total)` by `user_id`/`user_name` provides the same. |

**Overview Dashboard Verdict**: 9 of 12 panels are DUPLICATE. 2 panels are ATHENA-ONLY (Event Distribution, Session Complexity).

---

## 2. Cost Dashboard (`cost.json`) -- Athena

| Panel ID | Panel Title | Classification | Reasoning |
|----------|-------------|----------------|-----------|
| 1 | Total Cost | **DUPLICATE** | `SUM(cost_usd)` -- Same as Prometheus `claude_code_cost_usage_USD_total`. |
| 2 | Avg Cost / Session | **DUPLICATE** | `SUM(cost) / COUNT(DISTINCT session_id)` -- Both metrics in Prometheus. |
| 3 | Avg Cost / Prompt | **ATHENA-ONLY** | Cost divided by `COUNT(event_name = 'user_prompt')` -- Prometheus has no prompt count metric. Requires Athena event-level data to count prompt events. |
| 4 | Avg Cost / API Call | **ATHENA-ONLY** | `AVG(cost_usd)` per individual API request row -- Prometheus only has cumulative cost, not per-request cost. The per-call average requires event-level division. |
| 5 | Cost Trend (Hourly, by Model) | **DUPLICATE** | Hourly cost by model time series -- Prometheus `rate(cost_usage_USD_total)` by model is identical. |
| 6 | Cumulative Cost Trend | **DUPLICATE** | Running sum of hourly cost -- Prometheus `increase(cost_usage_USD_total)` with cumulative sum transform provides the same. |
| 7 | Model Cost Distribution | **DUPLICATE** | Cost by model pie chart -- Same as Overview panel 8 and Prometheus `increase(cost_usage_USD_total)` by model. |
| 8 | Model Cost Efficiency Comparison | **ATHENA-ONLY** | Per-model: avg cost per call, cost per 1K output tokens, I/O ratio, cost share % -- Requires per-request `cost_usd`, `output_tokens`, `input_tokens` to compute averages. Prometheus has totals but not per-call distribution. |
| 9 | Cache Reuse Rate by Model | **DUPLICATE** | `cache_read / (cache_read + cache_creation)` -- Prometheus `claude_code_token_usage_tokens_total` with `type=cacheRead` and `type=cacheCreation` provides both components. |
| 10 | Top 10 Users by Cost | **DUPLICATE** | Cost by user bar chart -- Duplicate of Overview panel 11. Prometheus provides this. |
| 11 | Speed Mode Cost Comparison | **ATHENA-ONLY** | Cost grouped by `speed` field (normal/fast) -- Prometheus metrics do not carry a `speed` label. Requires Athena event field. |
| 12 | User Cost Detail | **ATHENA-ONLY** | Per-user table: sessions, api_calls count, token breakdowns, avg cost per session, avg cost per call -- Requires event-level aggregation for api_calls count and per-call averages. |

**Cost Dashboard Verdict**: 6 of 12 panels are DUPLICATE. 5 panels are ATHENA-ONLY.

---

## 3. Usage Dashboard (`usage.json`) -- Athena

| Panel ID | Panel Title | Classification | Reasoning |
|----------|-------------|----------------|-----------|
| 1 | Total Input Tokens | **DUPLICATE** | `SUM(input_tokens)` -- Prometheus `claude_code_token_usage_tokens_total{type="input"}`. |
| 2 | Total Output Tokens | **DUPLICATE** | `SUM(output_tokens)` -- Prometheus `claude_code_token_usage_tokens_total{type="output"}`. |
| 3 | Cache Read Tokens | **DUPLICATE** | `SUM(cache_read_tokens)` -- Prometheus `claude_code_token_usage_tokens_total{type="cacheRead"}`. |
| 4 | Cache Creation Tokens | **DUPLICATE** | `SUM(cache_creation_tokens)` -- Prometheus `claude_code_token_usage_tokens_total{type="cacheCreation"}`. |
| 5 | Token Usage by Type (Stacked Area) | **DUPLICATE** | Hourly token usage by type (input/output/cache_read/cache_creation) -- Prometheus `rate(token_usage_tokens_total)` by type provides the same stacked area. |
| 6 | Model Role Pattern (I/O Ratio) | **DUPLICATE** | Per-model token breakdown (input/output/cache_read/cache_create) bar chart -- Prometheus `increase(token_usage_tokens_total)` by model and type gives the same data. |
| 7 | Session Activity Summary | **ATHENA-ONLY** | Per-session table: start_time, duration, prompts, api_calls, tool_uses, cost, total I/O tokens, avg prompt length -- Cross-event join per session. Requires event-level fields (prompt_length, event_name filtering). |
| 8 | Prompt Length Distribution | **ATHENA-ONLY** | Histogram of `prompt_length` field from `user_prompt` events -- Prometheus has no prompt_length metric. Requires Athena event-level field. |
| 9 | Hourly Activity Pattern | **ATHENA-ONLY** | Events/sessions/users grouped by hour-of-day (not time series, but day-part analysis) -- Prometheus can show rates over time but not easily aggregate by hour-of-day across multi-day ranges. This is an analytical pattern best served by Athena. |
| 10 | Terminal & OS Distribution | **DUPLICATE** | Sessions by terminal_type/os_type -- Prometheus `claude_code_session_count_total` carries `terminal_type` and `os_type` labels. `count by (terminal_type, os_type) (increase(session_count_total))` provides the same. |
| 11 | Top 10 Users by Sessions | **DUPLICATE** | Session count by user -- Prometheus `increase(session_count_total)` by `user_id`/`user_name`. |
| 12 | Version Distribution | **DUPLICATE** | Sessions/users by `service_version` -- Prometheus `claude_code_session_count_total` carries `service_version` label. |

**Usage Dashboard Verdict**: 8 of 12 panels are DUPLICATE. 3 panels are ATHENA-ONLY.

---

## 4. Tool Analytics Dashboard (`tool-analytics.json`) -- Athena

| Panel ID | Panel Title | Classification | Reasoning |
|----------|-------------|----------------|-----------|
| 1 | Total Tool Executions | **ATHENA-ONLY** | `COUNT(*)` from `tool_result` events -- Prometheus has no tool execution counter (only `code_edit_tool_decision`). General tool results (Read, Write, Bash, Grep, etc.) are not captured in Prometheus. |
| 2 | Success Rate | **ATHENA-ONLY** | `success=true / total` from `tool_result` events -- Requires event-level `success` boolean field. Prometheus has no tool success metric. |
| 3 | Accept Rate | **ATHENA-ONLY** | `decision='accept' / total` from `tool_decision` events -- Athena has ALL tool decisions (all tools). Prometheus `code_edit_tool_decision_total` only covers code edit tools, not all tool decisions. Different scope. |
| 4 | Unique Tools | **ATHENA-ONLY** | `COUNT(DISTINCT tool_name)` from `tool_result` -- Prometheus has no equivalent for total distinct tools used. |
| 5 | Tool Usage Frequency | **ATHENA-ONLY** | Success/failure count per tool_name from `tool_result` events -- Requires event-level `success` field per tool. Prometheus does not track general tool execution counts. |
| 6 | Decision by Tool and Source | **ATHENA-ONLY** | Accept/reject per tool from `tool_decision` events -- Covers ALL tool types, not just code edit tools. Athena also has `source` field (config, user, auto) not in Prometheus. |
| 7 | Tool Performance Summary | **ATHENA-ONLY** | Per-tool: total, success count, success rate, avg/p95 duration_ms, avg/max result_size_bytes -- Requires event-level `duration_ms` and `tool_result_size_bytes` fields. Prometheus has no tool performance metrics. |
| 8 | Decision Source Distribution | **ATHENA-ONLY** | Pie chart of `source` field (config/user/auto) x `decision` -- Requires Athena `source` field on `tool_decision` events. Not in Prometheus. |
| 9 | Tool Execution Time Trend | **ATHENA-ONLY** | Time series of avg `duration_ms` per tool over time -- Requires event-level `duration_ms`. Prometheus has no tool latency histogram. |
| 10 | Tool Result Size by Tool | **ATHENA-ONLY** | Avg/max `tool_result_size_bytes` per tool -- Requires Athena event-level field. Not in Prometheus. |
| 11 | Recent Tool Errors | **ATHENA-ONLY** | Table of individual failed tool executions with timestamp, tool_name, user, error text, duration, result_size -- Requires event-level drill-down. Impossible with Prometheus counters. |

**Tool Analytics Dashboard Verdict**: 0 DUPLICATE. All 11 panels are ATHENA-ONLY.

---

## 5. API Performance Dashboard (`api-performance.json`) -- Athena

| Panel ID | Panel Title | Classification | Reasoning |
|----------|-------------|----------------|-----------|
| 1 | Avg Latency | **ATHENA-ONLY** | `AVG(duration_ms)` from `api_request` events -- Prometheus has no API latency histogram or duration metric. |
| 2 | Error Rate | **ATHENA-ONLY** | `api_error / (api_request + api_error)` -- Prometheus has no API error count metric. Requires Athena event-level data. |
| 3 | Total API Calls | **ATHENA-ONLY** | `COUNT(*)` from `api_request` events -- Prometheus has no API call counter. Session count is not the same as API call count (multiple API calls per session). |
| 4 | Avg Output Tokens / Call | **ATHENA-ONLY** | `AVG(output_tokens)` per individual API request -- Prometheus only has cumulative totals, not per-call averages. |
| 5 | API Latency Percentiles (p50/p90/p99) | **ATHENA-ONLY** | `approx_percentile(duration_ms, 0.50/0.90/0.99)` over time -- Requires event-level `duration_ms`. No Prometheus histogram for API latency. |
| 6 | Throughput Trend (API Calls/Hour) | **ATHENA-ONLY** | Hourly API call count by model -- Prometheus has no API call count metric. |
| 7 | Latency by Model (p50/p90/p99) | **ATHENA-ONLY** | Per-model latency percentile table with I/O ratio -- Requires `duration_ms` and per-request token fields. |
| 8 | Speed Mode Performance | **ATHENA-ONLY** | Latency/throughput by `speed` mode (normal/fast) per model -- Requires `speed` field and `duration_ms`. Neither available in Prometheus. |
| 9 | Cache Effect on Performance | **ATHENA-ONLY** | Latency and cost comparison: cache_hit vs no_cache per model -- Requires per-request `cache_read_tokens` and `duration_ms` correlation. |
| 10 | Errors by Status Code | **ATHENA-ONLY** | Error count by `status_code` from `api_error` events -- Requires event-level `status_code` field. Not in Prometheus. |
| 11 | Errors by Model | **ATHENA-ONLY** | Error count by model from `api_error` events -- Requires `api_error` event type. Not in Prometheus. |
| 12 | Error Trend | **ATHENA-ONLY** | Hourly API error count over time -- Requires `api_error` event counting. Not in Prometheus. |
| 13 | Recent API Errors | **ATHENA-ONLY** | Table of individual API errors: timestamp, model, status_code, error text, user, session, duration, attempt -- Event-level drill-down. Impossible with Prometheus. |

**API Performance Dashboard Verdict**: 0 DUPLICATE. All 13 panels are ATHENA-ONLY.

---

## 6. Real-Time Metrics Dashboard (`realtime-metrics.json`) -- Prometheus

This dashboard is the Prometheus-native dashboard. Listed here for completeness.

| Panel ID | Panel Title | Classification | Reasoning |
|----------|-------------|----------------|-----------|
| 100 | Activity Overview (row) | -- | Section header |
| 1 | Active Sessions | **PROMETHEUS-ONLY** | `increase(claude_code_session_count_total)` -- Real-time counter. |
| 2 | Total Cost (USD) | **PROMETHEUS-ONLY** | `increase(claude_code_cost_usage_USD_total)` -- Real-time counter. |
| 3 | Total Tokens | **PROMETHEUS-ONLY** | `increase(claude_code_token_usage_tokens_total)` -- Real-time counter. |
| 4 | Active Time | **PROMETHEUS-ONLY** | `increase(claude_code_active_time_seconds_total)` -- **Unique to Prometheus**. No Athena event captures active_time_seconds. |
| 101 | Cost & Token Trends (row) | -- | Section header |
| 5 | Cost Rate by Model | **PROMETHEUS-ONLY** | `rate(cost_usage_USD_total)` by model -- Real-time rate. |
| 6 | Token Consumption by Type | **PROMETHEUS-ONLY** | `rate(token_usage_tokens_total)` by type -- Real-time rate. |
| 102 | Development Activity (row) | -- | Section header |
| 7 | Lines of Code (Added vs Removed) | **PROMETHEUS-ONLY** | `rate(lines_of_code_count_total)` by type -- **Unique to Prometheus**. No Athena event captures lines of code. |
| 8 | Commits & Pull Requests | **PROMETHEUS-ONLY** | `rate(commit_count_total)` + `rate(pull_request_count_total)` -- **Unique to Prometheus**. No Athena event captures commits/PRs. |
| 103 | Tool & Code Editing Analytics (row) | -- | Section header |
| 9 | Code Edit Decisions (Accept vs Reject) | **PROMETHEUS-ONLY** | `increase(code_edit_tool_decision_total)` by decision -- Real-time. |
| 10 | Edit Decisions by Language | **PROMETHEUS-ONLY** | `rate(code_edit_tool_decision_total)` by language -- **Unique label**. Athena `tool_decision` events have `tool_name` but not `language`. |
| 11 | Active Time (User vs CLI) | **PROMETHEUS-ONLY** | `increase(active_time_seconds_total)` by type -- **Unique to Prometheus**. |
| 104 | Session & Rate Details (row) | -- | Section header |
| 12 | Session Rate | **PROMETHEUS-ONLY** | `rate(session_count_total)` -- Real-time rate. |
| 13 | Token Rate by Model | **PROMETHEUS-ONLY** | `rate(token_usage_tokens_total)` by model -- Real-time rate. |
| 14 | Edit Tool Decision Trend | **PROMETHEUS-ONLY** | `rate(code_edit_tool_decision_total)` by decision -- Real-time trend. |

**Real-Time Metrics Dashboard Verdict**: All 14 panels are PROMETHEUS-ONLY (keep as-is).

---

## Consolidated Summary

### Panel Counts by Classification

| Dashboard | Total Panels | DUPLICATE | ATHENA-ONLY | PROMETHEUS-ONLY |
|-----------|-------------|-----------|-------------|-----------------|
| Overview | 12 | 9 | 2 | 0 |
| Cost | 12 | 6 | 5 | 0 |
| Usage | 12 | 8 | 3 | 0 |
| Tool Analytics | 11 | 0 | 11 | 0 |
| API Performance | 13 | 0 | 13 | 0 |
| Real-Time Metrics | 14 | 0 | 0 | 14 |
| **TOTAL** | **74** | **23** | **34** | **14** |

### DUPLICATE Panels to Remove from Athena (23 panels)

These panels show aggregate counts/sums that Prometheus counters already provide:

**Overview Dashboard (9 panels to remove):**
1. Total Sessions (panel 1)
2. Active Users (panel 2)
3. Total Cost (panel 3)
4. Total Tokens (panel 4)
5. Avg Session Cost (panel 5)
6. Daily Activity Trend (panel 6)
7. Cost Trend by Model (panel 7)
8. Model Cost Share (panel 8)
9. Top 10 Users by Cost (panel 11)
10. Top 10 Users by Tokens (panel 12)

**Cost Dashboard (6 panels to remove):**
1. Total Cost (panel 1)
2. Avg Cost / Session (panel 2)
3. Cost Trend Hourly by Model (panel 5)
4. Cumulative Cost Trend (panel 6)
5. Model Cost Distribution (panel 7)
6. Cache Reuse Rate by Model (panel 9)
7. Top 10 Users by Cost (panel 10)

**Usage Dashboard (8 panels to remove):**
1. Total Input Tokens (panel 1)
2. Total Output Tokens (panel 2)
3. Cache Read Tokens (panel 3)
4. Cache Creation Tokens (panel 4)
5. Token Usage by Type Stacked Area (panel 5)
6. Model Role Pattern I/O Ratio (panel 6)
7. Terminal & OS Distribution (panel 10)
8. Top 10 Users by Sessions (panel 11)
9. Version Distribution (panel 12)

### ATHENA-ONLY Panels to Keep (34 panels)

These panels require event-level detail that Prometheus counters cannot provide:

**Overview Dashboard (2 panels):**
- Event Distribution (panel 9) -- needs event_name grouping
- Session Complexity Overview (panel 10) -- cross-event per-session join

**Cost Dashboard (5 panels):**
- Avg Cost / Prompt (panel 3) -- needs prompt event count
- Avg Cost / API Call (panel 4) -- needs per-request cost
- Model Cost Efficiency Comparison (panel 8) -- per-call averages, I/O ratio, cost/1K tokens
- Speed Mode Cost Comparison (panel 11) -- `speed` field not in Prometheus
- User Cost Detail (panel 12) -- per-user api_calls count, per-call averages

**Usage Dashboard (3 panels):**
- Session Activity Summary (panel 7) -- cross-event per-session drill-down
- Prompt Length Distribution (panel 8) -- `prompt_length` field
- Hourly Activity Pattern (panel 9) -- hour-of-day analytical aggregation

**Tool Analytics Dashboard (11 panels -- ALL):**
- Total Tool Executions (panel 1)
- Success Rate (panel 2)
- Accept Rate (panel 3)
- Unique Tools (panel 4)
- Tool Usage Frequency (panel 5)
- Decision by Tool and Source (panel 6)
- Tool Performance Summary (panel 7)
- Decision Source Distribution (panel 8)
- Tool Execution Time Trend (panel 9)
- Tool Result Size by Tool (panel 10)
- Recent Tool Errors (panel 11)

**API Performance Dashboard (13 panels -- ALL):**
- Avg Latency (panel 1)
- Error Rate (panel 2)
- Total API Calls (panel 3)
- Avg Output Tokens / Call (panel 4)
- API Latency Percentiles p50/p90/p99 (panel 5)
- Throughput Trend (panel 6)
- Latency by Model (panel 7)
- Speed Mode Performance (panel 8)
- Cache Effect on Performance (panel 9)
- Errors by Status Code (panel 10)
- Errors by Model (panel 11)
- Error Trend (panel 12)
- Recent API Errors (panel 13)

### PROMETHEUS-ONLY Metrics (no Athena equivalent)

These metrics exist only in Prometheus and have no corresponding Athena event:

| Metric | What it captures |
|--------|-----------------|
| `claude_code_active_time_seconds_total` | Active coding time (user vs CLI) |
| `claude_code_lines_of_code_count_total` | Lines added/removed |
| `claude_code_commit_count_total` | Git commits made |
| `claude_code_pull_request_count_total` | PRs created |
| `claude_code_code_edit_tool_decision_total` (language label) | Code edit decisions with programming language breakdown |

---

## Recommended Restructuring

### Keep Athena Dashboards for Deep Analytics
- **Tool Analytics** (11 panels) -- 100% Athena-only, no changes needed
- **API Performance** (13 panels) -- 100% Athena-only, no changes needed
- **Cost Dashboard** -- Trim 7 duplicate panels, keep 5 Athena-only panels
- **Usage Dashboard** -- Trim 8 duplicate panels, keep 3 Athena-only panels (+1 from overview)
- **Overview Dashboard** -- Trim 9 duplicate panels, keep 2 Athena-only panels; OR consolidate remaining Athena-only panels into Cost/Usage dashboards and retire the Overview entirely

### Keep Prometheus Dashboard as the Real-Time Operations View
- All 14 panels are Prometheus-only
- This is the primary dashboard for live monitoring, rates, and development activity metrics
- Move duplicate aggregate views (totals, trends, top-N by user) here instead of Athena

### Net Result
- **Remove ~23 duplicate Athena panels** that Prometheus already serves
- **Athena narrows to its strengths**: event-level drill-down, cross-event correlation, per-request analytics, error details, tool performance
- **Prometheus becomes the primary dashboard** for totals, trends, rates, and real-time activity
