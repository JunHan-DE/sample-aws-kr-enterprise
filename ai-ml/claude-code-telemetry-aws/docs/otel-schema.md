# Claude Code OpenTelemetry 텔레메트리 스키마

이 문서는 Claude Code가 내보내는 OpenTelemetry 텔레메트리 데이터의 전체 스키마를 정의합니다.
메트릭은 OTel Metrics 프로토콜, 이벤트는 OTel Logs 프로토콜을 통해 전송됩니다.

---

## 목차

1. [리소스 속성 (Resource Attributes)](#리소스-속성-resource-attributes)
2. [공통 속성 (Common Attributes)](#공통-속성-common-attributes)
3. [메트릭 (Metrics)](#메트릭-metrics)
4. [이벤트 (Events)](#이벤트-events)

---

## 리소스 속성 (Resource Attributes)

모든 텔레메트리 데이터에 포함되는 리소스 수준 속성입니다.
OTel Resource 스펙에 따라 텔레메트리를 생성하는 엔티티를 식별합니다.

| 속성명 | 타입 | 설명 | 예시 |
|--------|------|------|------|
| `service.name` | string | 서비스 식별자 (고정값) | `claude-code` |
| `service.version` | string | Claude Code 버전 | `1.0.32` |
| `os.type` | string | 운영체제 종류 | `darwin`, `linux`, `windows` |
| `os.version` | string | 운영체제 버전 | `25.2.0` |
| `host.arch` | string | 호스트 CPU 아키텍처 | `arm64`, `x86_64` |

---

## 공통 속성 (Common Attributes)

모든 메트릭과 이벤트 데이터 포인트에 포함되는 속성입니다.

| 속성명 | 타입 | 설명 | 예시 |
|--------|------|------|------|
| `session.id` | string | 세션 고유 식별자 (UUID) | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `app.version` | string | 애플리케이션 버전 | `1.0.32` |
| `organization.id` | string | 조직 식별자 | `org_abc123` |
| `user.account_uuid` | string | 사용자 계정 UUID | `user_def456` |
| `terminal.type` | string | 터미널 종류 | `vscode`, `iterm2`, `terminal`, `warp` |

---

## 메트릭 (Metrics)

Claude Code는 OTel Metrics 프로토콜(OTLP)을 통해 아래 메트릭을 내보냅니다.
모든 메트릭은 **monotonic counter** 타입이며, 누적(cumulative) 집계 방식을 사용합니다.

### claude_code.session.count

세션 시작 횟수를 추적하는 카운터입니다.

| 항목 | 값 |
|------|-----|
| **이름** | `claude_code.session.count` |
| **타입** | Counter (monotonic) |
| **단위** | `{session}` |
| **설명** | Claude Code 세션이 시작된 횟수 |

**메트릭 고유 속성:** 없음 (공통 속성만 사용)

---

### claude_code.lines_of_code.count

코드 라인 변경 수를 추적하는 카운터입니다.

| 항목 | 값 |
|------|-----|
| **이름** | `claude_code.lines_of_code.count` |
| **타입** | Counter (monotonic) |
| **단위** | `{line}` |
| **설명** | Claude Code가 수정한 코드 라인 수 |

**메트릭 고유 속성:**

| 속성명 | 타입 | 필수 | 설명 | 허용값 |
|--------|------|------|------|--------|
| `type` | string | Y | 변경 유형 | `added`, `removed` |

---

### claude_code.pull_request.count

Pull Request 생성 횟수를 추적하는 카운터입니다.

| 항목 | 값 |
|------|-----|
| **이름** | `claude_code.pull_request.count` |
| **타입** | Counter (monotonic) |
| **단위** | `{pull_request}` |
| **설명** | Claude Code로 생성된 Pull Request 수 |

**메트릭 고유 속성:** 없음 (공통 속성만 사용)

---

### claude_code.commit.count

Git 커밋 생성 횟수를 추적하는 카운터입니다.

| 항목 | 값 |
|------|-----|
| **이름** | `claude_code.commit.count` |
| **타입** | Counter (monotonic) |
| **단위** | `{commit}` |
| **설명** | Claude Code로 생성된 Git 커밋 수 |

**메트릭 고유 속성:** 없음 (공통 속성만 사용)

---

### claude_code.cost.usage

API 사용 비용을 추적하는 카운터입니다. 단위는 USD입니다.

| 항목 | 값 |
|------|-----|
| **이름** | `claude_code.cost.usage` |
| **타입** | Counter (monotonic) |
| **단위** | `USD` |
| **설명** | Claude Code API 호출에 사용된 비용 (USD) |

**메트릭 고유 속성:**

| 속성명 | 타입 | 필수 | 설명 | 예시 |
|--------|------|------|------|------|
| `model` | string | Y | 사용된 AI 모델 이름 | `claude-opus-4-6`, `claude-sonnet-4-20250514` |

---

### claude_code.token.usage

토큰 사용량을 추적하는 카운터입니다.

| 항목 | 값 |
|------|-----|
| **이름** | `claude_code.token.usage` |
| **타입** | Counter (monotonic) |
| **단위** | `{token}` |
| **설명** | Claude Code API 호출에 사용된 토큰 수 |

**메트릭 고유 속성:**

| 속성명 | 타입 | 필수 | 설명 | 허용값 |
|--------|------|------|------|--------|
| `type` | string | Y | 토큰 유형 | `input`, `output`, `cacheRead`, `cacheCreation` |
| `model` | string | Y | 사용된 AI 모델 이름 | `claude-opus-4-6`, `claude-sonnet-4-20250514` |

**토큰 유형 설명:**

| 값 | 설명 |
|----|------|
| `input` | 모델에 전송된 입력 토큰 |
| `output` | 모델이 생성한 출력 토큰 |
| `cacheRead` | 프롬프트 캐시에서 읽은 토큰 |
| `cacheCreation` | 프롬프트 캐시에 기록된 토큰 |

---

### claude_code.code_edit_tool.decision

코드 편집 도구의 수락/거절 결정을 추적하는 카운터입니다.

| 항목 | 값 |
|------|-----|
| **이름** | `claude_code.code_edit_tool.decision` |
| **타입** | Counter (monotonic) |
| **단위** | `{decision}` |
| **설명** | 코드 편집 도구 사용 결정 (수락/거절) 횟수 |

**메트릭 고유 속성:**

| 속성명 | 타입 | 필수 | 설명 | 허용값 |
|--------|------|------|------|--------|
| `tool` | string | Y | 편집 도구 이름 | `Edit`, `Write`, `NotebookEdit` |
| `decision` | string | Y | 결정 유형 | `accept`, `reject` |
| `language` | string | Y | 프로그래밍 언어 | `python`, `typescript`, `javascript`, `go` 등 |

---

### claude_code.active_time.total

활성 사용 시간을 추적하는 카운터입니다.

| 항목 | 값 |
|------|-----|
| **이름** | `claude_code.active_time.total` |
| **타입** | Counter (monotonic) |
| **단위** | `s` (초) |
| **설명** | Claude Code가 활성 상태인 총 시간 (초) |

**메트릭 고유 속성:** 없음 (공통 속성만 사용)

---

## 이벤트 (Events)

Claude Code는 OTel Logs 프로토콜(OTLP)을 통해 아래 이벤트를 내보냅니다.
각 이벤트는 LogRecord의 `Body`에 구조화된 데이터로 전달되며, `event.name` 속성으로 이벤트 유형을 식별합니다.
모든 이벤트에 공통 속성이 포함됩니다.

### claude_code.user_prompt

사용자가 입력한 프롬프트 이벤트입니다. 기본적으로 프롬프트 내용은 리다이렉트(redacted)됩니다.

| 항목 | 값 |
|------|-----|
| **이벤트명** | `claude_code.user_prompt` |
| **SeverityText** | `INFO` |
| **설명** | 사용자 프롬프트 입력 이벤트 |

**이벤트 고유 속성:**

| 속성명 | 타입 | 필수 | 설명 | 비고 |
|--------|------|------|------|------|
| `prompt_length` | int | Y | 프롬프트 문자 수 | 항상 포함 |
| `prompt` | string | N | 프롬프트 원문 | 기본적으로 수집하지 않음 (redacted). 조직 설정에 따라 활성화 가능 |

---

### claude_code.tool_result

도구 실행 결과 이벤트입니다.

| 항목 | 값 |
|------|-----|
| **이벤트명** | `claude_code.tool_result` |
| **SeverityText** | `INFO` |
| **설명** | 도구 실행 완료 이벤트 |

**이벤트 고유 속성:**

| 속성명 | 타입 | 필수 | 설명 | 예시 |
|--------|------|------|------|------|
| `tool_name` | string | Y | 실행된 도구 이름 | `Read`, `Edit`, `Bash`, `Grep`, `Glob`, `Write` |
| `success` | boolean | Y | 실행 성공 여부 | `true`, `false` |
| `duration_ms` | int | Y | 실행 소요 시간 (밀리초) | `1523` |
| `error` | string | N | 오류 메시지 (실패 시) | `File not found` |
| `decision` | string | Y | 도구 실행 결정 | `accept`, `reject` |
| `source` | string | Y | 결정 주체 | `user`, `auto`, `policy` |
| `tool_parameters` | string | N | 도구 호출 파라미터 (JSON) | `{"file_path": "/src/main.py"}` |

---

### claude_code.api_request

AI 모델 API 호출 이벤트입니다.

| 항목 | 값 |
|------|-----|
| **이벤트명** | `claude_code.api_request` |
| **SeverityText** | `INFO` |
| **설명** | API 요청 완료 이벤트 |

**이벤트 고유 속성:**

| 속성명 | 타입 | 필수 | 설명 | 예시 |
|--------|------|------|------|------|
| `model` | string | Y | 사용된 AI 모델 이름 | `claude-opus-4-6` |
| `cost_usd` | double | Y | 요청 비용 (USD) | `0.0123` |
| `duration_ms` | int | Y | 요청 소요 시간 (밀리초) | `3542` |
| `input_tokens` | int | Y | 입력 토큰 수 | `1500` |
| `output_tokens` | int | Y | 출력 토큰 수 | `800` |
| `cache_read_tokens` | int | Y | 캐시에서 읽은 토큰 수 | `500` |
| `cache_creation_tokens` | int | Y | 캐시에 기록된 토큰 수 | `200` |

---

### claude_code.api_error

AI 모델 API 호출 오류 이벤트입니다.

| 항목 | 값 |
|------|-----|
| **이벤트명** | `claude_code.api_error` |
| **SeverityText** | `ERROR` |
| **설명** | API 요청 실패 이벤트 |

**이벤트 고유 속성:**

| 속성명 | 타입 | 필수 | 설명 | 예시 |
|--------|------|------|------|------|
| `model` | string | Y | 사용된 AI 모델 이름 | `claude-opus-4-6` |
| `error` | string | Y | 오류 메시지 | `rate_limit_exceeded` |
| `status_code` | int | Y | HTTP 상태 코드 | `429`, `500`, `503` |
| `duration_ms` | int | Y | 요청 소요 시간 (밀리초) | `1200` |
| `attempt` | int | Y | 재시도 횟수 (1부터 시작) | `1`, `2`, `3` |

---

### claude_code.tool_decision

도구 사용 결정 이벤트입니다. 사용자 또는 정책에 의한 도구 허용/거절을 기록합니다.

| 항목 | 값 |
|------|-----|
| **이벤트명** | `claude_code.tool_decision` |
| **SeverityText** | `INFO` |
| **설명** | 도구 사용 허용/거절 결정 이벤트 |

**이벤트 고유 속성:**

| 속성명 | 타입 | 필수 | 설명 | 예시 |
|--------|------|------|------|------|
| `tool_name` | string | Y | 도구 이름 | `Bash`, `Edit`, `Write` |
| `decision` | string | Y | 결정 유형 | `accept`, `reject` |
| `source` | string | Y | 결정 주체 | `user`, `auto`, `policy` |

---

## 데이터 흐름 아키텍처

```
Developer PC (Claude Code)
    │
    │  OTLP (gRPC :4317 / HTTP :4318)
    ▼
NLB (Network Load Balancer)
    │
    ▼
ADOT Collector (ECS Fargate)
    ├── Metrics Pipeline ──→ prometheusremotewrite ──→ AMP (Amazon Managed Prometheus)
    │                                                       │
    │                                                       ▼
    │                                               Amazon Managed Grafana
    │
    └── Logs Pipeline ────→ awscloudwatchlogs ──→ CloudWatch Logs
                                                        │
                                                        ▼ (Subscription Filter)
                                                    Firehose + Lambda Transformer
                                                        │
                                                        ▼
                                                    S3 (Parquet)
                                                        │
                                                        ▼
                                                    Athena (SQL 분석)
                                                        │
                                                        ▼
                                                Amazon Managed Grafana
```

---

## 메트릭 스키마 요약 테이블

| 메트릭 이름 | 타입 | 단위 | 고유 속성 |
|-------------|------|------|-----------|
| `claude_code.session.count` | Counter | `{session}` | - |
| `claude_code.lines_of_code.count` | Counter | `{line}` | `type` |
| `claude_code.pull_request.count` | Counter | `{pull_request}` | - |
| `claude_code.commit.count` | Counter | `{commit}` | - |
| `claude_code.cost.usage` | Counter | `USD` | `model` |
| `claude_code.token.usage` | Counter | `{token}` | `type`, `model` |
| `claude_code.code_edit_tool.decision` | Counter | `{decision}` | `tool`, `decision`, `language` |
| `claude_code.active_time.total` | Counter | `s` | - |

## 이벤트 스키마 요약 테이블

| 이벤트명 | Severity | 주요 속성 |
|----------|----------|-----------|
| `claude_code.user_prompt` | INFO | `prompt_length`, `prompt` |
| `claude_code.tool_result` | INFO | `tool_name`, `success`, `duration_ms`, `error`, `decision`, `source`, `tool_parameters` |
| `claude_code.api_request` | INFO | `model`, `cost_usd`, `duration_ms`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens` |
| `claude_code.api_error` | ERROR | `model`, `error`, `status_code`, `duration_ms`, `attempt` |
| `claude_code.tool_decision` | INFO | `tool_name`, `decision`, `source` |
