> **참고**: 이 문서는 설계 산출물(design artifact)입니다. 대시보드 중복 제거 작업의 설계 명세로 사용되었으며, 최종 대시보드 구조는 `docs/dashboard-guide.md`를 참조하세요.

# Dashboard Design Specification

## Executive Summary

This specification defines the new dashboard architecture for Claude Code telemetry. Based on the overlap analysis, 23 duplicate Athena panels are removed and the remaining 34 Athena-only panels are reorganized into a streamlined layout. The 5 Athena dashboards are consolidated into 4 by merging Overview into the other dashboards, and 6 new Athena-unique panels are added to exploit event-level analytical capabilities that Prometheus cannot provide.

### Design Principles

1. **Real-Time Metrics (Prometheus)** -- KEEP EXACTLY AS IS. The user is satisfied with this dashboard.
2. **Athena dashboards** -- Focus exclusively on event-level deep analysis: per-request drill-downs, cross-event correlation, field-level analytics (`duration_ms`, `speed`, `prompt_length`, `tool_result_size_bytes`, `status_code`, `source`, `error`, `attempt`).
3. **No duplication** -- Remove all panels whose data is obtainable from Prometheus counters.
4. **Cross-navigation** -- Bidirectional links between Prometheus and all Athena dashboards with contextual annotations.
5. **Consolidation** -- Retire the Overview dashboard; relocate its 2 Athena-only panels into the Usage dashboard.

---

## New Dashboard Architecture

### Dashboard List

| # | File | UID | Title | Data Source | Purpose | Panels |
|---|------|-----|-------|-------------|---------|--------|
| 1 | `realtime-metrics.json` | `claude-code-realtime` | Claude Code - Real-Time Metrics | Prometheus (AMP) | Live monitoring, rates, development activity, aggregates | 14 (unchanged) |
| 2 | `cost-analysis.json` | `claude-code-cost` | Claude Code - Cost Deep Analysis | Athena | Per-request cost efficiency, speed mode, model comparison, user cost detail | 7 |
| 3 | `usage-insights.json` | `claude-code-usage` | Claude Code - Usage & Session Insights | Athena | Session drill-down, prompt analytics, event distribution, activity patterns | 7 |
| 4 | `tool-analytics.json` | `claude-code-tools` | Claude Code - Tool Analytics | Athena | Tool execution, success/failure, decisions, performance, errors | 11 (unchanged) |
| 5 | `api-performance.json` | `claude-code-api` | Claude Code - API Performance | Athena | API latency, throughput, speed modes, cache effects, errors | 13 (unchanged) |

**Total: 5 dashboards, 52 panels** (down from 6 dashboards, 74 panels).

### Retirement Plan

| Old Dashboard | Action | Reason |
|---------------|--------|--------|
| `overview.json` | **DELETE** | 9 of 12 panels are duplicates of Prometheus. 2 Athena-only panels (Event Distribution, Session Complexity) move to Usage & Session Insights. |

### Consolidation Rationale

- **Overview (12 panels)**: After removing 9 duplicates, only 2 unique panels remain. Too few for a standalone dashboard. Both panels (Event Distribution, Session Complexity) naturally fit the Usage & Session Insights theme.
- **Cost (12 panels)**: After removing 7 duplicates, 5 unique panels remain. Adding 2 new analytical panels brings it to 7 -- a focused, self-contained dashboard.
- **Usage (12 panels)**: After removing 9 duplicates, 3 unique panels remain. Adding 2 relocated panels from Overview plus 2 new panels brings it to 7.
- **Tool Analytics (11 panels)**: 100% Athena-only. No changes needed.
- **API Performance (13 panels)**: 100% Athena-only. No changes needed.

---

## Panel Removal List (23 Panels)

### Overview Dashboard -- ALL REMOVED (entire dashboard retired)

| Panel ID | Title | Reason |
|----------|-------|--------|
| 1 | Total Sessions | Prometheus `increase(session_count_total)` |
| 2 | Active Users | Prometheus `count by (user_id)(session_count_total)` |
| 3 | Total Cost (USD) | Prometheus `increase(cost_usage_USD_total)` |
| 4 | Total Tokens | Prometheus `increase(token_usage_tokens_total)` |
| 5 | Avg Session Cost | Prometheus cost/sessions ratio |
| 6 | Daily Activity Trend | Prometheus `rate(session_count_total)` |
| 7 | Cost Trend by Model (Stacked) | Prometheus `rate(cost_usage_USD_total)` by model |
| 8 | Model Cost Share | Prometheus `increase(cost_usage_USD_total)` by model |
| 9 | Event Distribution | **RELOCATED** to Usage & Session Insights |
| 10 | Session Complexity Overview | **RELOCATED** to Usage & Session Insights |
| 11 | Top 10 Users by Cost | Prometheus `increase(cost_usage_USD_total)` by user |
| 12 | Top 10 Users by Tokens | Prometheus `increase(token_usage_tokens_total)` by user |

### Cost Dashboard -- 7 Panels Removed

| Panel ID | Title | Reason |
|----------|-------|--------|
| 1 | Total Cost | Prometheus `increase(cost_usage_USD_total)` |
| 2 | Avg Cost / Session | Prometheus cost/sessions ratio |
| 5 | Cost Trend (Hourly, by Model) | Prometheus `rate(cost_usage_USD_total)` by model |
| 6 | Cumulative Cost Trend | Prometheus `increase(cost_usage_USD_total)` cumulative |
| 7 | Model Cost Distribution | Prometheus `increase(cost_usage_USD_total)` by model |
| 9 | Cache Reuse Rate by Model | Prometheus `token_usage_tokens_total{type=cacheRead/cacheCreation}` |
| 10 | Top 10 Users by Cost | Prometheus `increase(cost_usage_USD_total)` by user |

### Usage Dashboard -- 9 Panels Removed

| Panel ID | Title | Reason |
|----------|-------|--------|
| 1 | Total Input Tokens | Prometheus `token_usage_tokens_total{type=input}` |
| 2 | Total Output Tokens | Prometheus `token_usage_tokens_total{type=output}` |
| 3 | Cache Read Tokens | Prometheus `token_usage_tokens_total{type=cacheRead}` |
| 4 | Cache Creation Tokens | Prometheus `token_usage_tokens_total{type=cacheCreation}` |
| 5 | Token Usage by Type (Stacked Area) | Prometheus `rate(token_usage_tokens_total)` by type |
| 6 | Model Role Pattern (I/O Ratio) | Prometheus `increase(token_usage_tokens_total)` by model+type |
| 10 | Terminal & OS Distribution | Prometheus `session_count_total` by terminal_type/os_type |
| 11 | Top 10 Users by Sessions | Prometheus `increase(session_count_total)` by user |
| 12 | Version Distribution | Prometheus `session_count_total` by service_version |

---

## Dashboard 1: Real-Time Metrics (Prometheus) -- NO CHANGES

**File**: `realtime-metrics.json`
**UID**: `claude-code-realtime`
**Data Source**: Prometheus (AMP), uid `amp`
**Refresh**: 30s
**Time Range**: `now-6h` to `now`

This dashboard is kept exactly as-is. All 14 panels (plus 4 row headers) remain unchanged. The only modification is updating the navigation links to reflect the new Athena dashboard structure.

### Updated Navigation Links

```json
"links": [
  {"title": "Cost Deep Analysis (Athena)", "url": "/d/claude-code-cost", "type": "link", "icon": "database", "tooltip": "Event-level cost efficiency, speed mode, per-call analysis"},
  {"title": "Usage & Session Insights (Athena)", "url": "/d/claude-code-usage", "type": "link", "icon": "database", "tooltip": "Session drill-down, prompt analytics, event distribution"},
  {"title": "Tool Analytics (Athena)", "url": "/d/claude-code-tools", "type": "link", "icon": "database", "tooltip": "Tool execution, success rates, performance metrics"},
  {"title": "API Performance (Athena)", "url": "/d/claude-code-api", "type": "link", "icon": "database", "tooltip": "API latency percentiles, errors, speed modes"}
]
```

### Panels (unchanged)

| ID | Title | Type | gridPos | Query (PromQL) |
|----|-------|------|---------|----------------|
| 100 | Activity Overview | row | h:1 w:24 x:0 y:0 | -- |
| 1 | Active Sessions | stat | h:4 w:6 x:0 y:1 | `sum(increase(claude_code_session_count_total{...}[$__range]))` |
| 2 | Total Cost (USD) | stat | h:4 w:6 x:6 y:1 | `sum(increase(claude_code_cost_usage_USD_total{...}[$__range]))` |
| 3 | Total Tokens | stat | h:4 w:6 x:12 y:1 | `sum(increase(claude_code_token_usage_tokens_total{...}[$__range]))` |
| 4 | Active Time | stat | h:4 w:6 x:18 y:1 | `sum(increase(claude_code_active_time_seconds_total{...}[$__range]))` |
| 101 | Cost & Token Trends | row | h:1 w:24 x:0 y:5 | -- |
| 5 | Cost Rate by Model | timeseries | h:8 w:12 x:0 y:6 | `sum by (model)(rate(claude_code_cost_usage_USD_total{...}[5m]))` |
| 6 | Token Consumption by Type | timeseries | h:8 w:12 x:12 y:6 | `sum by (type)(rate(claude_code_token_usage_tokens_total{...}[5m]))` |
| 102 | Development Activity | row | h:1 w:24 x:0 y:14 | -- |
| 7 | Lines of Code (Added vs Removed) | timeseries | h:8 w:12 x:0 y:15 | `sum by (type)(rate(claude_code_lines_of_code_count_total{...}[5m]))` |
| 8 | Commits & Pull Requests | timeseries | h:8 w:12 x:12 y:15 | `sum(rate(claude_code_commit_count_total{...}[5m]))` + `sum(rate(claude_code_pull_request_count_total{...}[5m]))` |
| 103 | Tool & Code Editing Analytics | row | h:1 w:24 x:0 y:23 | -- |
| 9 | Code Edit Decisions (Accept vs Reject) | piechart | h:8 w:8 x:0 y:24 | `sum by (decision)(increase(claude_code_code_edit_tool_decision_total{...}[$__range]))` |
| 10 | Edit Decisions by Language | timeseries | h:8 w:8 x:8 y:24 | `sum by (language)(rate(claude_code_code_edit_tool_decision_total{...}[5m]))` |
| 11 | Active Time (User vs CLI) | piechart | h:8 w:8 x:16 y:24 | `sum by (type)(increase(claude_code_active_time_seconds_total{...}[$__range]))` |
| 104 | Session & Rate Details | row | h:1 w:24 x:0 y:32 | -- |
| 12 | Session Rate | timeseries | h:8 w:8 x:0 y:33 | `sum(rate(claude_code_session_count_total{...}[5m]))` |
| 13 | Token Rate by Model | timeseries | h:8 w:8 x:8 y:33 | `sum by (model)(rate(claude_code_token_usage_tokens_total{...}[5m]))` |
| 14 | Edit Tool Decision Trend | timeseries | h:8 w:8 x:16 y:33 | `sum by (decision)(rate(claude_code_code_edit_tool_decision_total{...}[5m]))` |

---

## Dashboard 2: Cost Deep Analysis (Athena)

**File**: `cost-analysis.json` (renamed from `cost.json`)
**UID**: `claude-code-cost`
**Data Source**: Athena, uid `athena`
**Time Range**: `now-7d` to `now`
**Description**: Event-level cost analysis -- per-request efficiency, speed mode comparison, model cost breakdown, user cost attribution. For aggregate cost totals and trends, see Real-Time Metrics.

### Template Variables

Same as current cost.json: `team`, `user`, `model` (all Athena-sourced).

### Navigation Links

```json
"links": [
  {"title": "Real-Time Metrics (Prometheus)", "url": "/d/claude-code-realtime", "type": "link", "icon": "lightning", "tooltip": "Live cost totals, rates, trends -- switch here for aggregate views"},
  {"title": "Usage & Session Insights", "url": "/d/claude-code-usage", "type": "link"},
  {"title": "Tool Analytics", "url": "/d/claude-code-tools", "type": "link"},
  {"title": "API Performance", "url": "/d/claude-code-api", "type": "link"}
]
```

### Panel Specification (7 panels)

#### Row 0: KPI Stats (y: 0, h: 4)

**Panel 1: Avg Cost / Prompt** (KEPT from cost.json panel 3)
- Type: `stat`
- gridPos: `{"h": 4, "w": 8, "x": 0, "y": 0}`
- SQL:
```sql
SELECT ROUND(total_cost / NULLIF(prompt_count, 0), 4) AS avg_cost_per_prompt
FROM (
  SELECT
    SUM(CASE WHEN event_name = 'claude_code.api_request' THEN cost_usd ELSE 0 END) AS total_cost,
    COUNT(CASE WHEN event_name = 'claude_code.user_prompt' THEN 1 END) AS prompt_count
  FROM claude_code_telemetry.events
  WHERE event_name IN ('claude_code.api_request', 'claude_code.user_prompt')
    AND "timestamp" BETWEEN from_iso8601_timestamp('${__from:date:iso}') AND from_iso8601_timestamp('${__to:date:iso}')
    AND (team_id LIKE '${team}' OR '${team}' = '%')
    AND (COALESCE(user_name, user_id) LIKE '${user}' OR '${user}' = '%')
    AND (model LIKE '${model}' OR '${model}' = '%' OR model IS NULL)
)
```
- Unit: `currencyUSD`
- Color: fixed orange
- Options: `colorMode: background_solid`, `graphMode: area`, `textMode: value_and_name`

**Panel 2: Avg Cost / API Call** (KEPT from cost.json panel 4)
- Type: `stat`
- gridPos: `{"h": 4, "w": 8, "x": 8, "y": 0}`
- SQL:
```sql
SELECT ROUND(AVG(cost_usd), 6) AS avg_cost_per_call
FROM claude_code_telemetry.events
WHERE event_name = 'claude_code.api_request'
  AND "timestamp" BETWEEN from_iso8601_timestamp('${__from:date:iso}') AND from_iso8601_timestamp('${__to:date:iso}')
  AND (team_id LIKE '${team}' OR '${team}' = '%')
  AND (COALESCE(user_name, user_id) LIKE '${user}' OR '${user}' = '%')
  AND (model LIKE '${model}' OR '${model}' = '%')
```
- Unit: `currencyUSD`
- Color: fixed purple

**Panel 3: Cost per 1K Output Tokens** (NEW -- Athena-unique)
- Type: `stat`
- gridPos: `{"h": 4, "w": 8, "x": 16, "y": 0}`
- SQL:
```sql
SELECT ROUND(SUM(cost_usd) * 1000.0 / NULLIF(SUM(output_tokens), 0), 4) AS cost_per_1k_output
FROM claude_code_telemetry.events
WHERE event_name = 'claude_code.api_request'
  AND "timestamp" BETWEEN from_iso8601_timestamp('${__from:date:iso}') AND from_iso8601_timestamp('${__to:date:iso}')
  AND (team_id LIKE '${team}' OR '${team}' = '%')
  AND (COALESCE(user_name, user_id) LIKE '${user}' OR '${user}' = '%')
  AND (model LIKE '${model}' OR '${model}' = '%')
```
- Unit: `currencyUSD`
- Color: fixed green
- Rationale: Requires per-request cost_usd and output_tokens fields. Prometheus has only cumulative totals, not per-call cost/token correlation.

#### Row 1: Model Efficiency + Speed Mode (y: 4, h: 8)

**Panel 4: Model Cost Efficiency Comparison** (KEPT from cost.json panel 8)
- Type: `table`
- gridPos: `{"h": 8, "w": 16, "x": 0, "y": 4}`
- SQL:
```sql
SELECT model,
  COUNT(*) AS api_calls,
  ROUND(SUM(cost_usd), 4) AS total_cost,
  ROUND(AVG(cost_usd), 6) AS avg_cost_per_call,
  ROUND(SUM(cost_usd) * 1000.0 / NULLIF(SUM(output_tokens), 0), 6) AS cost_per_1k_output_tokens,
  ROUND(CAST(SUM(input_tokens) AS DOUBLE) / NULLIF(CAST(SUM(output_tokens) AS DOUBLE), 0), 2) AS io_ratio,
  ROUND(SUM(cost_usd) * 100.0 / NULLIF(
    (SELECT SUM(cost_usd) FROM claude_code_telemetry.events
     WHERE event_name = 'claude_code.api_request'
       AND "timestamp" BETWEEN from_iso8601_timestamp('${__from:date:iso}') AND from_iso8601_timestamp('${__to:date:iso}')
       AND (team_id LIKE '${team}' OR '${team}' = '%')
       AND (COALESCE(user_name, user_id) LIKE '${user}' OR '${user}' = '%')), 0), 1) AS cost_share_pct
FROM claude_code_telemetry.events
WHERE event_name = 'claude_code.api_request'
  AND "timestamp" BETWEEN from_iso8601_timestamp('${__from:date:iso}') AND from_iso8601_timestamp('${__to:date:iso}')
  AND (team_id LIKE '${team}' OR '${team}' = '%')
  AND (COALESCE(user_name, user_id) LIKE '${user}' OR '${user}' = '%')
GROUP BY model ORDER BY total_cost DESC
```
- Field overrides: total_cost/avg_cost_per_call/cost_per_1k_output_tokens = `currencyUSD`, cost_share_pct = `percent`

**Panel 5: Speed Mode Cost Comparison** (KEPT from cost.json panel 11)
- Type: `barchart`
- gridPos: `{"h": 8, "w": 8, "x": 16, "y": 4}`
- SQL:
```sql
SELECT COALESCE(speed, 'unknown') AS speed_mode,
  COUNT(*) AS api_calls,
  ROUND(SUM(cost_usd), 4) AS total_cost,
  ROUND(AVG(cost_usd), 6) AS avg_cost_per_call
FROM claude_code_telemetry.events
WHERE event_name = 'claude_code.api_request'
  AND "timestamp" BETWEEN from_iso8601_timestamp('${__from:date:iso}') AND from_iso8601_timestamp('${__to:date:iso}')
  AND (team_id LIKE '${team}' OR '${team}' = '%')
  AND (COALESCE(user_name, user_id) LIKE '${user}' OR '${user}' = '%')
  AND (model LIKE '${model}' OR '${model}' = '%')
GROUP BY COALESCE(speed, 'unknown') ORDER BY total_cost DESC
```
- Unit: `currencyUSD`
- Orientation: horizontal

#### Row 2: Cost Trend per Prompt + User Detail (y: 12)

**Panel 6: Cost per Prompt Trend** (NEW -- Athena-unique)
- Type: `timeseries`
- gridPos: `{"h": 8, "w": 24, "x": 0, "y": 12}`
- SQL:
```sql
SELECT date_trunc('hour', "timestamp") AS time,
  ROUND(
    SUM(CASE WHEN event_name = 'claude_code.api_request' THEN cost_usd ELSE 0 END)
    / NULLIF(COUNT(CASE WHEN event_name = 'claude_code.user_prompt' THEN 1 END), 0),
  4) AS cost_per_prompt,
  ROUND(AVG(CASE WHEN event_name = 'claude_code.api_request' THEN cost_usd END), 6) AS avg_cost_per_call
FROM claude_code_telemetry.events
WHERE event_name IN ('claude_code.api_request', 'claude_code.user_prompt')
  AND "timestamp" BETWEEN from_iso8601_timestamp('${__from:date:iso}') AND from_iso8601_timestamp('${__to:date:iso}')
  AND (team_id LIKE '${team}' OR '${team}' = '%')
  AND (COALESCE(user_name, user_id) LIKE '${user}' OR '${user}' = '%')
  AND (model LIKE '${model}' OR '${model}' = '%' OR model IS NULL)
GROUP BY 1 ORDER BY 1
```
- Unit: `currencyUSD`
- Fill opacity: 10, line width: 2
- Rationale: Shows cost efficiency trend per user prompt over time. Requires correlating api_request cost with user_prompt events -- impossible in Prometheus.

**Panel 7: User Cost Detail** (KEPT from cost.json panel 12)
- Type: `table`
- gridPos: `{"h": 10, "w": 24, "x": 0, "y": 20}`
- SQL:
```sql
SELECT COALESCE(user_name, user_id) AS user_display,
  COUNT(DISTINCT session_id) AS sessions,
  COUNT(*) AS api_calls,
  SUM(input_tokens) AS input_tokens,
  SUM(output_tokens) AS output_tokens,
  SUM(COALESCE(cache_read_tokens, 0)) AS cache_read_tokens,
  ROUND(SUM(cost_usd), 4) AS total_cost_usd,
  ROUND(SUM(cost_usd) / NULLIF(COUNT(DISTINCT session_id), 0), 4) AS avg_cost_per_session,
  ROUND(AVG(cost_usd), 6) AS avg_cost_per_call
FROM claude_code_telemetry.events
WHERE event_name = 'claude_code.api_request'
  AND "timestamp" BETWEEN from_iso8601_timestamp('${__from:date:iso}') AND from_iso8601_timestamp('${__to:date:iso}')
  AND (team_id LIKE '${team}' OR '${team}' = '%')
  AND (COALESCE(user_name, user_id) LIKE '${user}' OR '${user}' = '%')
  AND (model LIKE '${model}' OR '${model}' = '%')
GROUP BY COALESCE(user_name, user_id) ORDER BY total_cost_usd DESC
```
- Field overrides: total_cost_usd/avg_cost_per_session/avg_cost_per_call = `currencyUSD`

---

## Dashboard 3: Usage & Session Insights (Athena)

**File**: `usage-insights.json` (renamed from `usage.json`)
**UID**: `claude-code-usage`
**Data Source**: Athena, uid `athena`
**Time Range**: `now-7d` to `now`
**Description**: Event-level session analysis -- cross-event session drill-down, prompt patterns, event distribution, hourly activity. For aggregate token counts and user totals, see Real-Time Metrics.

### Template Variables

Same as current usage.json: `team`, `user`, `model` (all Athena-sourced).

### Navigation Links

```json
"links": [
  {"title": "Real-Time Metrics (Prometheus)", "url": "/d/claude-code-realtime", "type": "link", "icon": "lightning", "tooltip": "Live token counts, session rates, user activity -- switch here for aggregate views"},
  {"title": "Cost Deep Analysis", "url": "/d/claude-code-cost", "type": "link"},
  {"title": "Tool Analytics", "url": "/d/claude-code-tools", "type": "link"},
  {"title": "API Performance", "url": "/d/claude-code-api", "type": "link"}
]
```

### Panel Specification (7 panels)

#### Row 0: Event & Session KPIs (y: 0, h: 8)

**Panel 1: Event Distribution** (RELOCATED from overview.json panel 9)
- Type: `piechart`
- gridPos: `{"h": 8, "w": 8, "x": 0, "y": 0}`
- SQL:
```sql
SELECT REPLACE(event_name, 'claude_code.', '') AS event_type,
  COUNT(*) AS count
FROM claude_code_telemetry.events
WHERE "timestamp" BETWEEN from_iso8601_timestamp('${__from:date:iso}') AND from_iso8601_timestamp('${__to:date:iso}')
  AND (team_id LIKE '${team}' OR '${team}' = '%')
  AND (COALESCE(user_name, user_id) LIKE '${user}' OR '${user}' = '%')
GROUP BY event_name ORDER BY count DESC
```
- Options: donut, legend table with value+percent on right

**Panel 2: Hourly Activity Pattern** (KEPT from usage.json panel 9)
- Type: `barchart`
- gridPos: `{"h": 8, "w": 8, "x": 8, "y": 0}`
- SQL:
```sql
SELECT LPAD(CAST(hour("timestamp") AS VARCHAR), 2, '0') || ':00' AS hour_utc,
  COUNT(*) AS events,
  COUNT(DISTINCT session_id) AS sessions,
  COUNT(DISTINCT user_id) AS users
FROM claude_code_telemetry.events
WHERE "timestamp" BETWEEN from_iso8601_timestamp('${__from:date:iso}') AND from_iso8601_timestamp('${__to:date:iso}')
  AND (team_id LIKE '${team}' OR '${team}' = '%')
  AND (COALESCE(user_name, user_id) LIKE '${user}' OR '${user}' = '%')
GROUP BY hour("timestamp") ORDER BY hour("timestamp")
```
- Orientation: vertical

**Panel 3: Prompt Length Distribution** (KEPT from usage.json panel 8)
- Type: `barchart`
- gridPos: `{"h": 8, "w": 8, "x": 16, "y": 0}`
- SQL:
```sql
SELECT CASE
    WHEN prompt_length < 50 THEN '0-49'
    WHEN prompt_length < 100 THEN '50-99'
    WHEN prompt_length < 200 THEN '100-199'
    WHEN prompt_length < 500 THEN '200-499'
    WHEN prompt_length < 1000 THEN '500-999'
    ELSE '1000+'
  END AS length_bucket,
  COUNT(*) AS count
FROM claude_code_telemetry.events
WHERE event_name = 'claude_code.user_prompt'
  AND prompt_length IS NOT NULL
  AND "timestamp" BETWEEN from_iso8601_timestamp('${__from:date:iso}') AND from_iso8601_timestamp('${__to:date:iso}')
  AND (team_id LIKE '${team}' OR '${team}' = '%')
  AND (COALESCE(user_name, user_id) LIKE '${user}' OR '${user}' = '%')
GROUP BY 1 ORDER BY MIN(prompt_length)
```
- Orientation: vertical

#### Row 1: Session Complexity (y: 8, h: 8)

**Panel 4: Session Complexity Overview** (RELOCATED from overview.json panel 10)
- Type: `table`
- gridPos: `{"h": 8, "w": 24, "x": 0, "y": 8}`
- SQL:
```sql
SELECT COALESCE(user_name, user_id) AS user_display,
  session_id,
  COUNT(CASE WHEN event_name = 'claude_code.user_prompt' THEN 1 END) AS prompts,
  COUNT(CASE WHEN event_name = 'claude_code.api_request' THEN 1 END) AS api_calls,
  COUNT(CASE WHEN event_name = 'claude_code.tool_result' THEN 1 END) AS tool_uses,
  ROUND(SUM(CASE WHEN event_name = 'claude_code.api_request' THEN cost_usd ELSE 0 END), 4) AS cost_usd,
  date_diff('second', MIN("timestamp"), MAX("timestamp")) AS duration_sec
FROM claude_code_telemetry.events
WHERE "timestamp" BETWEEN from_iso8601_timestamp('${__from:date:iso}') AND from_iso8601_timestamp('${__to:date:iso}')
  AND (team_id LIKE '${team}' OR '${team}' = '%')
  AND (COALESCE(user_name, user_id) LIKE '${user}' OR '${user}' = '%')
GROUP BY COALESCE(user_name, user_id), session_id
ORDER BY cost_usd DESC LIMIT 20
```
- Field overrides: cost_usd = `currencyUSD`, duration_sec = `s`, session_id width = 120

#### Row 2: Session Detail + New Panels (y: 16)

**Panel 5: Session Activity Summary** (KEPT from usage.json panel 7)
- Type: `table`
- gridPos: `{"h": 10, "w": 24, "x": 0, "y": 16}`
- SQL:
```sql
SELECT session_id,
  COALESCE(MAX(user_name), MAX(user_id)) AS user_display,
  MIN("timestamp") AS start_time,
  date_diff('second', MIN("timestamp"), MAX("timestamp")) AS duration_sec,
  COUNT(CASE WHEN event_name = 'claude_code.user_prompt' THEN 1 END) AS prompts,
  COUNT(CASE WHEN event_name = 'claude_code.api_request' THEN 1 END) AS api_calls,
  COUNT(CASE WHEN event_name = 'claude_code.tool_result' THEN 1 END) AS tool_uses,
  ROUND(SUM(CASE WHEN event_name = 'claude_code.api_request' THEN cost_usd ELSE 0 END), 4) AS cost_usd,
  SUM(CASE WHEN event_name = 'claude_code.api_request' THEN input_tokens + output_tokens ELSE 0 END) AS total_io_tokens,
  ROUND(AVG(CASE WHEN event_name = 'claude_code.user_prompt' THEN prompt_length END), 0) AS avg_prompt_length
FROM claude_code_telemetry.events
WHERE "timestamp" BETWEEN from_iso8601_timestamp('${__from:date:iso}') AND from_iso8601_timestamp('${__to:date:iso}')
  AND (team_id LIKE '${team}' OR '${team}' = '%')
  AND (COALESCE(user_name, user_id) LIKE '${user}' OR '${user}' = '%')
GROUP BY session_id ORDER BY start_time DESC LIMIT 50
```
- Field overrides: cost_usd = `currencyUSD`, duration_sec = `s`, session_id width = 120

**Panel 6: Session Flow Pattern** (NEW -- Athena-unique)
- Type: `timeseries`
- gridPos: `{"h": 8, "w": 12, "x": 0, "y": 26}`
- SQL:
```sql
SELECT date_trunc('hour', "timestamp") AS time,
  COUNT(CASE WHEN event_name = 'claude_code.user_prompt' THEN 1 END) AS prompts,
  COUNT(CASE WHEN event_name = 'claude_code.api_request' THEN 1 END) AS api_calls,
  COUNT(CASE WHEN event_name = 'claude_code.tool_result' THEN 1 END) AS tool_uses,
  COUNT(CASE WHEN event_name = 'claude_code.api_error' THEN 1 END) AS api_errors
FROM claude_code_telemetry.events
WHERE "timestamp" BETWEEN from_iso8601_timestamp('${__from:date:iso}') AND from_iso8601_timestamp('${__to:date:iso}')
  AND (team_id LIKE '${team}' OR '${team}' = '%')
  AND (COALESCE(user_name, user_id) LIKE '${user}' OR '${user}' = '%')
GROUP BY 1 ORDER BY 1
```
- Fill opacity: 15, line width: 2
- Color overrides: prompts=blue, api_calls=green, tool_uses=orange, api_errors=red
- Rationale: Breaks down event types over time -- shows the interaction flow pattern (prompt -> api -> tool). Prometheus has no event-type-level counter; only Athena can distinguish event_name.

**Panel 7: Prompt Complexity vs Cost** (NEW -- Athena-unique)
- Type: `table`
- gridPos: `{"h": 8, "w": 12, "x": 12, "y": 26}`
- SQL:
```sql
SELECT CASE
    WHEN prompt_length < 50 THEN '0-49'
    WHEN prompt_length < 100 THEN '50-99'
    WHEN prompt_length < 200 THEN '100-199'
    WHEN prompt_length < 500 THEN '200-499'
    WHEN prompt_length < 1000 THEN '500-999'
    ELSE '1000+'
  END AS prompt_bucket,
  COUNT(*) AS prompt_count,
  ROUND(AVG(session_cost), 4) AS avg_session_cost,
  ROUND(AVG(session_api_calls), 1) AS avg_api_calls_per_session,
  ROUND(AVG(session_tools), 1) AS avg_tools_per_session
FROM (
  SELECT p.session_id, p.prompt_length,
    SUM(CASE WHEN e.event_name = 'claude_code.api_request' THEN e.cost_usd ELSE 0 END) AS session_cost,
    COUNT(CASE WHEN e.event_name = 'claude_code.api_request' THEN 1 END) AS session_api_calls,
    COUNT(CASE WHEN e.event_name = 'claude_code.tool_result' THEN 1 END) AS session_tools
  FROM claude_code_telemetry.events p
  JOIN claude_code_telemetry.events e ON p.session_id = e.session_id
  WHERE p.event_name = 'claude_code.user_prompt'
    AND p.prompt_length IS NOT NULL
    AND p."timestamp" BETWEEN from_iso8601_timestamp('${__from:date:iso}') AND from_iso8601_timestamp('${__to:date:iso}')
    AND e."timestamp" BETWEEN from_iso8601_timestamp('${__from:date:iso}') AND from_iso8601_timestamp('${__to:date:iso}')
    AND (p.team_id LIKE '${team}' OR '${team}' = '%')
    AND (COALESCE(p.user_name, p.user_id) LIKE '${user}' OR '${user}' = '%')
  GROUP BY p.session_id, p.prompt_length
)
GROUP BY 1
ORDER BY MIN(prompt_length)
```
- Field overrides: avg_session_cost = `currencyUSD`
- Rationale: Correlates prompt length with downstream session complexity and cost -- a cross-event join that only Athena can perform.

---

## Dashboard 4: Tool Analytics (Athena) -- NO PANEL CHANGES

**File**: `tool-analytics.json`
**UID**: `claude-code-tools`
**Data Source**: Athena, uid `athena`
**Time Range**: `now-7d` to `now`

All 11 panels are 100% Athena-only. No panels added or removed. Only navigation links updated.

### Updated Navigation Links

```json
"links": [
  {"title": "Real-Time Metrics (Prometheus)", "url": "/d/claude-code-realtime", "type": "link", "icon": "lightning", "tooltip": "Live code edit decisions, development activity rates"},
  {"title": "Cost Deep Analysis", "url": "/d/claude-code-cost", "type": "link"},
  {"title": "Usage & Session Insights", "url": "/d/claude-code-usage", "type": "link"},
  {"title": "API Performance", "url": "/d/claude-code-api", "type": "link"}
]
```

### Panels (unchanged)

| ID | Title | Type | gridPos |
|----|-------|------|---------|
| 1 | Total Tool Executions | stat | h:4 w:6 x:0 y:0 |
| 2 | Success Rate | stat | h:4 w:6 x:6 y:0 |
| 3 | Accept Rate | stat | h:4 w:6 x:12 y:0 |
| 4 | Unique Tools | stat | h:4 w:6 x:18 y:0 |
| 5 | Tool Usage Frequency | barchart | h:8 w:12 x:0 y:4 |
| 6 | Decision by Tool and Source | barchart | h:8 w:12 x:12 y:4 |
| 7 | Tool Performance Summary | table | h:8 w:12 x:0 y:12 |
| 8 | Decision Source Distribution | piechart | h:8 w:12 x:12 y:12 |
| 9 | Tool Execution Time Trend | timeseries | h:8 w:24 x:0 y:20 |
| 10 | Tool Result Size by Tool | barchart | h:8 w:12 x:0 y:28 |
| 11 | Recent Tool Errors | table | h:8 w:12 x:12 y:28 |

All queries and configurations remain identical to the current `tool-analytics.json`.

---

## Dashboard 5: API Performance (Athena) -- NO PANEL CHANGES

**File**: `api-performance.json`
**UID**: `claude-code-api`
**Data Source**: Athena, uid `athena`
**Time Range**: `now-7d` to `now`

All 13 panels are 100% Athena-only. No panels added or removed. Only navigation links updated.

### Updated Navigation Links

```json
"links": [
  {"title": "Real-Time Metrics (Prometheus)", "url": "/d/claude-code-realtime", "type": "link", "icon": "lightning", "tooltip": "Live cost rates, token rates, session activity"},
  {"title": "Cost Deep Analysis", "url": "/d/claude-code-cost", "type": "link"},
  {"title": "Usage & Session Insights", "url": "/d/claude-code-usage", "type": "link"},
  {"title": "Tool Analytics", "url": "/d/claude-code-tools", "type": "link"}
]
```

### Panels (unchanged)

| ID | Title | Type | gridPos |
|----|-------|------|---------|
| 1 | Avg Latency | stat | h:4 w:6 x:0 y:0 |
| 2 | Error Rate | stat | h:4 w:6 x:6 y:0 |
| 3 | Total API Calls | stat | h:4 w:6 x:12 y:0 |
| 4 | Avg Output Tokens / Call | stat | h:4 w:6 x:18 y:0 |
| 5 | API Latency Percentiles (p50/p90/p99) | timeseries | h:8 w:12 x:0 y:4 |
| 6 | Throughput Trend (API Calls/Hour) | timeseries | h:8 w:12 x:12 y:4 |
| 7 | Latency by Model (p50/p90/p99) | table | h:8 w:12 x:0 y:12 |
| 8 | Speed Mode Performance | table | h:8 w:12 x:12 y:12 |
| 9 | Cache Effect on Performance | table | h:8 w:12 x:0 y:20 |
| 10 | Errors by Status Code | barchart | h:8 w:6 x:12 y:20 |
| 11 | Errors by Model | barchart | h:8 w:6 x:18 y:20 |
| 12 | Error Trend | timeseries | h:8 w:24 x:0 y:28 |
| 13 | Recent API Errors | table | h:8 w:24 x:0 y:36 |

All queries and configurations remain identical to the current `api-performance.json`.

---

## New Panels Summary

| # | Dashboard | Panel Title | Type | Rationale |
|---|-----------|-------------|------|-----------|
| 1 | Cost Deep Analysis | Cost per 1K Output Tokens | stat | Per-request cost/token correlation impossible in Prometheus |
| 2 | Cost Deep Analysis | Cost per Prompt Trend | timeseries | Correlates api_request cost with user_prompt events over time |
| 3 | Usage & Session Insights | Session Flow Pattern | timeseries | Event-type breakdown over time (prompt/api/tool/error) |
| 4 | Usage & Session Insights | Prompt Complexity vs Cost | table | Cross-event join correlating prompt length to session cost and complexity |

---

## Navigation Strategy

### Principle: Context-Aware Cross-Links

Every dashboard includes links to all other dashboards. Links to Real-Time Metrics carry a lightning icon and tooltip explaining what aggregate views are available there. This replaces the removed duplicate panels with a direct pointer.

### Link Structure

| From Dashboard | To Dashboard | Context |
|----------------|--------------|---------|
| Real-Time Metrics | Cost Deep Analysis | "Drill into per-request cost efficiency" |
| Real-Time Metrics | Usage & Session Insights | "Drill into session-level event analysis" |
| Real-Time Metrics | Tool Analytics | "Tool execution details and performance" |
| Real-Time Metrics | API Performance | "API latency percentiles and error details" |
| Cost Deep Analysis | Real-Time Metrics | "Live cost totals, rates, trends" |
| Usage & Session Insights | Real-Time Metrics | "Live token counts, session rates" |
| Tool Analytics | Real-Time Metrics | "Live code edit decisions, activity rates" |
| API Performance | Real-Time Metrics | "Live cost rates, token rates" |

### Variable Passthrough

When linking between Athena dashboards, template variables are passed through the URL to maintain filter context:
- `/d/claude-code-cost?var-user=${user}&var-team=${team}&var-model=${model}`

Note: Variable passthrough between Prometheus and Athena dashboards is limited since they use different label schemas (`user_id` vs `user`). Links between the two dashboard types reset to "All" for safety.

---

## Implementation Checklist

### Phase 1: File Changes

1. **DELETE** `grafana/dashboards/overview.json`
2. **RENAME** `grafana/dashboards/cost.json` -> `grafana/dashboards/cost-analysis.json`
   - Remove panels 1, 2, 5, 6, 7, 9, 10
   - Add new panel: Cost per 1K Output Tokens (stat)
   - Add new panel: Cost per Prompt Trend (timeseries)
   - Re-sequence panel IDs (1-7)
   - Update gridPos for new layout
   - Update navigation links
3. **RENAME** `grafana/dashboards/usage.json` -> `grafana/dashboards/usage-insights.json`
   - Remove panels 1, 2, 3, 4, 5, 6, 10, 11, 12
   - Add relocated panels: Event Distribution, Session Complexity Overview (from overview.json)
   - Add new panel: Session Flow Pattern (timeseries)
   - Add new panel: Prompt Complexity vs Cost (table)
   - Re-sequence panel IDs (1-7)
   - Update gridPos for new layout
   - Update navigation links
4. **UPDATE** `grafana/dashboards/tool-analytics.json` -- navigation links only
5. **UPDATE** `grafana/dashboards/api-performance.json` -- navigation links only
6. **UPDATE** `grafana/dashboards/realtime-metrics.json` -- navigation links only

### Phase 2: Provisioning

7. Update Grafana provisioning config if it references `overview.json`
8. Verify all dashboard UIDs remain stable (no breakage to saved bookmarks)

### Phase 3: Validation

9. Verify no Athena panel duplicates a Prometheus metric
10. Verify all SQL queries use correct filter variables
11. Verify cross-dashboard links resolve correctly
12. Confirm `realtime-metrics.json` content is byte-for-byte unchanged (panels section)
