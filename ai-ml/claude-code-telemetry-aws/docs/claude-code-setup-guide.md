# Claude Code OpenTelemetry 설정 가이드

Claude Code의 OpenTelemetry(OTel) 텔레메트리를 AWS 관측성 플랫폼으로 전송하기 위한 개발자 설정 가이드입니다.

Claude Code는 메트릭을 OTel 표준 메트릭 프로토콜로, 이벤트를 OTel 로그/이벤트 프로토콜로 내보냅니다. 이 가이드는 개발자가 자신의 Claude Code 환경에서 텔레메트리를 활성화하고 AWS 인프라로 전송하는 방법을 설명합니다.

> **참고**: 이 문서는 [Claude Code 공식 모니터링 문서](https://code.claude.com/docs/en/monitoring-usage)를 기반으로 작성되었습니다.

---

## 목차

1. [빠른 시작](#1-빠른-시작)
2. [상세 환경변수 설정](#2-상세-환경변수-설정)
3. [팀/조직 구성](#3-팀조직-구성-otel_resource_attributes)
4. [관리자 설정 (Managed Settings)](#4-관리자-설정-managed-settings)
5. [메트릭 카디널리티 제어](#5-메트릭-카디널리티-제어)
6. [동적 헤더 (otelHeadersHelper)](#6-동적-헤더-otelheadershelper)
7. [수집 가능한 메트릭 및 이벤트](#7-수집-가능한-메트릭-및-이벤트)
8. [구성 예시](#8-구성-예시)
9. [트러블슈팅](#9-트러블슈팅)
10. [보안 및 개인정보 보호](#10-보안-및-개인정보-보호)

---

## 1. 빠른 시작

최소한의 환경변수만으로 텔레메트리 전송을 시작할 수 있습니다. 아래 환경변수를 설정한 후 `claude` 명령어를 실행하면 됩니다.

```bash
# 1. 텔레메트리 활성화 (필수)
export CLAUDE_CODE_ENABLE_TELEMETRY=1

# 2. 메트릭 및 로그 내보내기 설정
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp

# 3. OTLP 프로토콜 및 엔드포인트 설정
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://<NLB_DNS_NAME>:4317

# 4. Claude Code 실행
claude
```

> **참고**: 기본 내보내기 주기는 메트릭 60초, 로그 5초입니다. 디버깅 시에는 더 짧은 주기를 사용할 수 있습니다 (아래 트러블슈팅 섹션 참조).

---

## 2. 상세 환경변수 설정

### 필수 환경변수

| 환경변수 | 설명 | 값 |
|---------|------|-----|
| `CLAUDE_CODE_ENABLE_TELEMETRY` | 텔레메트리 수집 활성화 (필수) | `1` |

### 내보내기(Exporter) 설정

| 환경변수 | 설명 | 가능한 값 |
|---------|------|----------|
| `OTEL_METRICS_EXPORTER` | 메트릭 내보내기 유형 (쉼표로 구분 가능) | `otlp`, `prometheus`, `console` |
| `OTEL_LOGS_EXPORTER` | 로그/이벤트 내보내기 유형 (쉼표로 구분 가능) | `otlp`, `console` |

- 메트릭과 로그 내보내기는 각각 독립적으로 설정합니다. 필요한 것만 구성하면 됩니다.
- 여러 내보내기를 동시에 사용하려면 쉼표로 구분합니다 (예: `console,otlp`).

### OTLP 프로토콜 및 엔드포인트

| 환경변수 | 설명 | 가능한 값 |
|---------|------|----------|
| `OTEL_EXPORTER_OTLP_PROTOCOL` | OTLP 내보내기 프로토콜 (모든 시그널에 적용) | `grpc`, `http/json`, `http/protobuf` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP 수집기 엔드포인트 (모든 시그널에 적용) | `http://localhost:4317` |

### 시그널별 프로토콜/엔드포인트 오버라이드

메트릭과 로그를 서로 다른 백엔드로 보내야 할 경우, 아래 환경변수로 개별 설정할 수 있습니다.

| 환경변수 | 설명 | 예시 |
|---------|------|------|
| `OTEL_EXPORTER_OTLP_METRICS_PROTOCOL` | 메트릭 전용 프로토콜 (일반 설정 오버라이드) | `grpc`, `http/json`, `http/protobuf` |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | 메트릭 전용 엔드포인트 (일반 설정 오버라이드) | `http://localhost:4318/v1/metrics` |
| `OTEL_EXPORTER_OTLP_LOGS_PROTOCOL` | 로그 전용 프로토콜 (일반 설정 오버라이드) | `grpc`, `http/json`, `http/protobuf` |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | 로그 전용 엔드포인트 (일반 설정 오버라이드) | `http://localhost:4318/v1/logs` |

### 인증

| 환경변수 | 설명 | 예시 |
|---------|------|------|
| `OTEL_EXPORTER_OTLP_HEADERS` | OTLP 인증 헤더 | `Authorization=Bearer token` |
| `OTEL_EXPORTER_OTLP_METRICS_CLIENT_KEY` | mTLS 인증을 위한 클라이언트 키 파일 경로 | `/path/to/client.key` |
| `OTEL_EXPORTER_OTLP_METRICS_CLIENT_CERTIFICATE` | mTLS 인증을 위한 클라이언트 인증서 파일 경로 | `/path/to/client.crt` |

### 내보내기 주기 및 옵션

| 환경변수 | 설명 | 기본값 |
|---------|------|--------|
| `OTEL_METRIC_EXPORT_INTERVAL` | 메트릭 내보내기 주기 (밀리초) | `60000` (60초) |
| `OTEL_LOGS_EXPORT_INTERVAL` | 로그 내보내기 주기 (밀리초) | `5000` (5초) |
| `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE` | 메트릭 시간 집계 방식. AMP/Prometheus 백엔드는 반드시 `cumulative` 사용 | `cumulative` (권장) |

### 로깅 옵션

| 환경변수 | 설명 | 기본값 |
|---------|------|--------|
| `OTEL_LOG_USER_PROMPTS` | 사용자 프롬프트 내용 로깅 활성화 | 비활성화 (`1`로 활성화) |
| `OTEL_LOG_TOOL_DETAILS` | MCP 서버/도구 이름 및 스킬 이름 로깅 활성화 | 비활성화 (`1`로 활성화) |

> **주의**: `OTEL_LOG_USER_PROMPTS`를 활성화하면 사용자가 입력한 프롬프트의 전체 내용이 로그에 포함됩니다. 민감한 정보가 프롬프트에 포함될 수 있으므로 주의하여 사용하세요. 비활성화 상태에서는 프롬프트 길이만 기록됩니다.

---

## 3. 팀/조직 구성 (OTEL_RESOURCE_ATTRIBUTES)

여러 팀이나 부서가 있는 조직에서 그룹별 텔레메트리를 구분하려면 `OTEL_RESOURCE_ATTRIBUTES` 환경변수를 사용합니다.

```bash
export OTEL_RESOURCE_ATTRIBUTES="department=engineering,team.id=platform,cost_center=eng-123"
```

### 형식 요구사항

`OTEL_RESOURCE_ATTRIBUTES`는 W3C Baggage 사양에 따라 엄격한 형식 규칙이 있습니다.

- **쉼표로 구분된 key=value 쌍** 형식: `key1=value1,key2=value2`
- **공백 사용 불가**: 값에 공백을 포함할 수 없습니다
- **허용 문자**: US-ASCII 문자 (제어 문자, 공백, 큰따옴표, 쉼표, 세미콜론, 백슬래시 제외)
- **특수 문자**: 허용 범위 밖의 문자는 퍼센트 인코딩이 필요합니다

### 올바른 사용 예시

```bash
# 유효하지 않음 - 공백 포함
export OTEL_RESOURCE_ATTRIBUTES="org.name=My Company"

# 유효함 - 밑줄 또는 camelCase 사용
export OTEL_RESOURCE_ATTRIBUTES="org.name=My_Company"
export OTEL_RESOURCE_ATTRIBUTES="org.name=MyCompany"

# 유효함 - 특수 문자 퍼센트 인코딩
export OTEL_RESOURCE_ATTRIBUTES="org.name=My%20Company"
```

> **주의**: 값을 따옴표로 감싸도 공백이 이스케이프되지 않습니다. 예를 들어 `org.name="My Company"`는 리터럴 값 `"My Company"` (따옴표 포함)이 됩니다.

### 활용 방법

리소스 속성을 설정하면 모든 메트릭과 이벤트에 포함되어 다음이 가능합니다:

- 팀 또는 부서별 메트릭 필터링
- 비용 센터별 비용 추적
- 팀별 대시보드 생성
- 특정 팀에 대한 알림 설정

### 팀별 구성 예시

```bash
# 플랫폼 엔지니어링 팀
export OTEL_RESOURCE_ATTRIBUTES="department=engineering,team.id=platform,cost_center=eng-100"

# 데이터 사이언스 팀
export OTEL_RESOURCE_ATTRIBUTES="department=data_science,team.id=ml-ops,cost_center=ds-200"

# 프론트엔드 팀
export OTEL_RESOURCE_ATTRIBUTES="department=engineering,team.id=frontend,cost_center=eng-300"
```

---

## 4. 관리자 설정 (Managed Settings)

조직 관리자는 **Managed Settings 파일**을 통해 모든 사용자의 OpenTelemetry 설정을 중앙에서 관리할 수 있습니다. Managed Settings는 가장 높은 우선순위를 가지며 사용자가 오버라이드할 수 없습니다.

### Managed Settings 파일 경로

| OS | 경로 |
|----|------|
| **macOS** | `/Library/Application Support/ClaudeCode/managed-settings.json` |
| **Linux / WSL** | `/etc/claude-code/managed-settings.json` |
| **Windows** | `C:\Program Files\ClaudeCode\managed-settings.json` |

> 이 경로들은 시스템 전체 경로 (사용자 홈 디렉토리가 아님)로, 관리자 권한이 필요합니다.

### 설정 예시

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://<NLB_DNS_NAME>:4317",
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer your-org-token"
  }
}
```

### 설정 우선순위

높은 순서에서 낮은 순서:

1. **Managed Settings** (`managed-settings.json`) - 오버라이드 불가
2. **명령줄 인수** - 임시 세션 오버라이드
3. **로컬 프로젝트 설정** (`.claude/settings.local.json`)
4. **공유 프로젝트 설정** (`.claude/settings.json`)
5. **사용자 설정** (`~/.claude/settings.json`)

### 프로젝트 수준 설정

팀 전체에 설정을 공유하려면 프로젝트의 `.claude/settings.json`에 환경변수를 추가할 수 있습니다.

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://<NLB_DNS_NAME>:4317"
  }
}
```

> **팁**: 프로젝트 설정 파일은 Git 저장소에 커밋하여 팀원 모두가 동일한 텔레메트리 구성을 사용하도록 할 수 있습니다.

### MDM을 통한 배포

Managed Settings는 MDM(Mobile Device Management) 또는 기타 디바이스 관리 솔루션을 통해 배포할 수 있습니다. 이를 통해 조직 전체에 일관된 텔레메트리 설정을 적용할 수 있습니다.

---

## 5. 메트릭 카디널리티 제어

카디널리티(cardinality)는 메트릭에 포함되는 고유 속성 값의 조합 수를 의미합니다. 카디널리티가 높을수록 스토리지 비용이 증가하고 쿼리 성능이 저하될 수 있습니다. 아래 환경변수로 메트릭에 포함되는 속성을 제어할 수 있습니다.

| 환경변수 | 설명 | 기본값 | 비활성화 예시 |
|---------|------|--------|-------------|
| `OTEL_METRICS_INCLUDE_SESSION_ID` | 메트릭에 `session.id` 속성 포함 | `true` | `false` |
| `OTEL_METRICS_INCLUDE_VERSION` | 메트릭에 `app.version` 속성 포함 | `false` | `true` |
| `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` | 메트릭에 `user.account_uuid` 속성 포함 | `true` | `false` |

### 카디널리티 전략 가이드

- **높은 카디널리티** (세분화된 분석 필요): `session.id`와 `account_uuid`를 모두 활성화. 세션별, 사용자별 상세 분석이 가능하지만 스토리지 비용 증가.
- **중간 카디널리티** (일반적 권장): `session.id=false`, `account_uuid=true`. 사용자별 분석은 가능하되 세션 수준의 데이터는 제외하여 비용 절감.
- **낮은 카디널리티** (비용 최적화): `session.id=false`, `account_uuid=false`. 집계된 조직 수준의 메트릭만 수집.

```bash
# 예시: 중간 카디널리티 설정
export OTEL_METRICS_INCLUDE_SESSION_ID=false
export OTEL_METRICS_INCLUDE_VERSION=false
export OTEL_METRICS_INCLUDE_ACCOUNT_UUID=true
```

---

## 6. 동적 헤더 (otelHeadersHelper)

엔터프라이즈 환경에서 동적 인증이 필요한 경우, 스크립트를 통해 헤더를 동적으로 생성할 수 있습니다. 이 기능은 토큰이 주기적으로 갱신되어야 하는 경우에 유용합니다.

### 설정 방법

`.claude/settings.json` 파일에 `otelHeadersHelper`를 추가합니다:

```json
{
  "otelHeadersHelper": "/path/to/generate_opentelemetry_headers.sh"
}
```

### 스크립트 요구사항

스크립트는 HTTP 헤더를 나타내는 **문자열 key-value 쌍의 JSON 객체**를 stdout으로 출력해야 합니다:

```bash
#!/bin/bash
# 예시: AWS SigV4 또는 임시 토큰 기반 인증
TOKEN=$(aws sts get-session-token --query 'Credentials.SessionToken' --output text)
echo "{\"Authorization\": \"Bearer ${TOKEN}\", \"X-Custom-Header\": \"custom-value\"}"
```

```bash
#!/bin/bash
# 예시: 여러 헤더 생성
echo "{\"Authorization\": \"Bearer $(get-token.sh)\", \"X-API-Key\": \"$(get-api-key.sh)\"}"
```

### 갱신 동작

- 스크립트는 **시작 시** 실행되고, 이후 **주기적으로** 실행되어 토큰 갱신을 지원합니다.
- 기본 갱신 주기: **29분** (1,740,000ms)
- 갱신 주기 변경: `CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS` 환경변수로 설정

```bash
# 갱신 주기를 15분으로 변경
export CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS=900000
```

---

## 7. 수집 가능한 메트릭 및 이벤트

### 서비스 리소스 속성

모든 메트릭과 이벤트에 다음 리소스 속성이 포함됩니다:

| 속성 | 설명 |
|------|------|
| `service.name` | `claude-code` |
| `service.version` | 현재 Claude Code 버전 |
| `os.type` | 운영 체제 유형 (`linux`, `darwin`, `windows`) |
| `os.version` | 운영 체제 버전 |
| `host.arch` | 호스트 아키텍처 (`amd64`, `arm64`) |
| `wsl.version` | WSL 버전 (WSL 환경에서만 표시) |

Meter 이름: `com.anthropic.claude_code`

### 표준 속성

모든 메트릭과 이벤트에 공통으로 포함되는 속성:

| 속성 | 설명 | 제어 방법 |
|------|------|----------|
| `session.id` | 고유 세션 식별자 | `OTEL_METRICS_INCLUDE_SESSION_ID` (기본: true) |
| `app.version` | Claude Code 버전 | `OTEL_METRICS_INCLUDE_VERSION` (기본: false) |
| `organization.id` | 조직 UUID (인증 시) | 항상 포함 (가용 시) |
| `user.account_uuid` | 계정 UUID (인증 시) | `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` (기본: true) |
| `user.id` | 익명 디바이스/설치 식별자 | 항상 포함 |
| `user.email` | 사용자 이메일 (OAuth 인증 시) | 항상 포함 (가용 시) |
| `terminal.type` | 터미널 유형 (`iTerm.app`, `vscode`, `cursor`, `tmux`) | 감지 시 항상 포함 |

### 메트릭 목록

| 메트릭 이름 | 설명 | 단위 | 추가 속성 |
|------------|------|------|----------|
| `claude_code.session.count` | CLI 세션 시작 횟수 | count | - |
| `claude_code.lines_of_code.count` | 수정된 코드 라인 수 | count | `type`: `added`, `removed` |
| `claude_code.pull_request.count` | 생성된 PR 수 | count | - |
| `claude_code.commit.count` | 생성된 커밋 수 | count | - |
| `claude_code.cost.usage` | 세션 비용 | USD | `model`: 모델 식별자 |
| `claude_code.token.usage` | 사용된 토큰 수 | tokens | `type`: `input`, `output`, `cacheRead`, `cacheCreation`; `model`: 모델 식별자 |
| `claude_code.code_edit_tool.decision` | 코드 편집 도구 권한 결정 횟수 | count | `tool_name`, `decision`, `source`, `language` |
| `claude_code.active_time.total` | 실제 활동 시간 | seconds | `type`: `user` (키보드 인터랙션), `cli` (도구 실행 및 AI 응답) |

### 이벤트 목록

이벤트는 `OTEL_LOGS_EXPORTER`가 설정된 경우 OTel 로그/이벤트 프로토콜을 통해 내보내집니다.

#### 이벤트 상관관계 (prompt.id)

사용자가 프롬프트를 제출하면, Claude Code는 여러 API 호출과 도구 실행을 수행할 수 있습니다. `prompt.id` 속성을 통해 단일 프롬프트에서 발생한 모든 이벤트를 연결할 수 있습니다.

> **참고**: `prompt.id`는 매 프롬프트마다 고유 ID가 생성되어 시계열 수가 무한히 증가할 수 있으므로, 메트릭에는 포함되지 않습니다. 이벤트 수준의 분석과 감사 추적에만 사용하세요.

| 이벤트 이름 | 설명 | 주요 속성 |
|------------|------|----------|
| `claude_code.user_prompt` | 사용자 프롬프트 제출 시 | `prompt_length`, `prompt` (OTEL_LOG_USER_PROMPTS=1 시) |
| `claude_code.tool_result` | 도구 실행 완료 시 | `tool_name`, `success`, `duration_ms`, `error`, `tool_parameters` |
| `claude_code.api_request` | API 요청 시 | `model`, `cost_usd`, `duration_ms`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `speed` |
| `claude_code.api_error` | API 요청 실패 시 | `model`, `error`, `status_code`, `duration_ms`, `attempt`, `speed` |
| `claude_code.tool_decision` | 도구 권한 결정 시 | `tool_name`, `decision`, `source` |

모든 이벤트에는 `event.timestamp` (ISO 8601)과 `event.sequence` (세션 내 순서 카운터)가 포함됩니다.

---

## 8. 구성 예시

### AWS ADOT Collector로 전송 (gRPC)

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://<NLB_DNS_NAME>:4317
export OTEL_RESOURCE_ATTRIBUTES="department=engineering,team.id=platform"
```

### 메트릭과 로그를 서로 다른 백엔드로 전송

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=https://metrics-collector.your-domain.com:4318
export OTEL_EXPORTER_OTLP_LOGS_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=https://logs-collector.your-domain.com:4317
```

### 콘솔 디버깅 (개발/테스트 환경)

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=console
export OTEL_LOGS_EXPORTER=console
export OTEL_METRIC_EXPORT_INTERVAL=1000
```

### 메트릭만 수집 (이벤트/로그 없음)

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://<NLB_DNS_NAME>:4317
```

### 이벤트/로그만 수집 (메트릭 없음)

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://<NLB_DNS_NAME>:4317
```

### 쉘 프로파일에 영구 설정

`~/.zshrc` 또는 `~/.bashrc` 파일에 추가:

```bash
# Claude Code OpenTelemetry 설정
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://<NLB_DNS_NAME>:4317
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer your-token"
export OTEL_RESOURCE_ATTRIBUTES="department=engineering,team.id=my-team"
```

---

## 9. 트러블슈팅

### 텔레메트리가 수신되지 않는 경우

1. **`CLAUDE_CODE_ENABLE_TELEMETRY=1`이 설정되었는지 확인**

   ```bash
   echo $CLAUDE_CODE_ENABLE_TELEMETRY
   ```

2. **콘솔 내보내기로 확인**: 먼저 `console` 내보내기를 사용하여 텔레메트리가 생성되는지 확인합니다.

   ```bash
   export CLAUDE_CODE_ENABLE_TELEMETRY=1
   export OTEL_METRICS_EXPORTER=console
   export OTEL_LOGS_EXPORTER=console
   export OTEL_METRIC_EXPORT_INTERVAL=5000
   claude
   ```

   콘솔에 메트릭/로그 출력이 보이면 텔레메트리 생성은 정상입니다. 네트워크나 엔드포인트 문제를 점검하세요.

3. **내보내기 주기 단축**: 테스트 시 빠른 확인을 위해 주기를 줄입니다.

   ```bash
   export OTEL_METRIC_EXPORT_INTERVAL=5000   # 5초
   export OTEL_LOGS_EXPORT_INTERVAL=1000     # 1초
   ```

4. **엔드포인트 연결 확인**

   ```bash
   # gRPC 엔드포인트 연결 테스트
   curl -v http://<NLB_DNS_NAME>:4317

   # HTTP 엔드포인트 연결 테스트
   curl -v http://<NLB_DNS_NAME>:4318/v1/metrics
   ```

5. **프로토콜 불일치 확인**: gRPC 엔드포인트에 HTTP 프로토콜을 사용하거나 그 반대인 경우 데이터가 전송되지 않습니다.
   - gRPC 수집기: 포트 `4317`, `OTEL_EXPORTER_OTLP_PROTOCOL=grpc`
   - HTTP 수집기: 포트 `4318`, `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf` 또는 `http/json`

### 일부 메트릭만 보이는 경우

- `OTEL_METRICS_EXPORTER`와 `OTEL_LOGS_EXPORTER`를 **별도로** 설정해야 합니다. 하나만 설정하면 해당 시그널만 전송됩니다.
- 메트릭의 기본 내보내기 주기가 60초이므로, 최소 60초 이상 기다려야 첫 번째 메트릭이 전송됩니다.

### 인증 오류

- `OTEL_EXPORTER_OTLP_HEADERS` 형식을 확인합니다: `key=value` 형식이어야 합니다.
- 동적 헤더를 사용하는 경우, 헤더 생성 스크립트를 직접 실행하여 유효한 JSON이 출력되는지 확인합니다.

  ```bash
  /path/to/generate_opentelemetry_headers.sh
  # 출력 예시: {"Authorization": "Bearer valid-token"}
  ```

### OTEL_RESOURCE_ATTRIBUTES 관련

- 값에 **공백이 포함되면 안 됩니다**. 공백은 퍼센트 인코딩(`%20`)을 사용하세요.
- 따옴표로 감싸도 공백이 이스케이프되지 않습니다.

### 메트릭 시간 집계 (Temporality) 문제

**중요**: 이 프로젝트는 AMP(Amazon Managed Prometheus)를 메트릭 백엔드로 사용합니다.
Prometheus Remote Write 익스포터는 **cumulative 시간 집계만 지원**하며, delta 시간 집계 메트릭은 **경고 없이 삭제**됩니다.

```bash
# 반드시 cumulative 사용 (AMP/Prometheus 필수)
export OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative

# 또는 이 환경변수를 설정하지 않으면 기본값(cumulative)이 적용됩니다

# [주의] delta를 사용하면 메트릭이 AMP에 도달하지 않습니다!
# export OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=delta  # 사용 금지
```

---

## 10. 보안 및 개인정보 보호

- 텔레메트리는 **옵트인 방식**이며 명시적 설정이 필요합니다.
- 원시 파일 내용이나 코드 스니펫은 메트릭이나 이벤트에 **포함되지 않습니다**.
- 도구 실행 이벤트에는 bash 명령어와 파일 경로가 `tool_parameters` 필드에 포함되며, 이 값에 민감한 정보가 포함될 수 있습니다. 명령어에 시크릿이 포함될 수 있는 경우, 텔레메트리 백엔드에서 `tool_parameters`를 필터링하거나 수정하도록 설정하세요.
- OAuth로 인증된 경우 `user.email`이 텔레메트리 속성에 포함됩니다. 이것이 우려되는 경우, 텔레메트리 백엔드에서 해당 필드를 필터링하세요.
- 사용자 프롬프트 내용은 **기본적으로 수집되지 않습니다**. 프롬프트 길이만 기록됩니다. 프롬프트 내용을 포함하려면 `OTEL_LOG_USER_PROMPTS=1`을 설정해야 합니다.
- MCP 서버/도구 이름 및 스킬 이름은 사용자별 설정을 노출할 수 있으므로 **기본적으로 로깅되지 않습니다**. 포함하려면 `OTEL_LOG_TOOL_DETAILS=1`을 설정해야 합니다.

---

## 참고 자료

- [Claude Code 공식 모니터링 문서](https://docs.anthropic.com/en/docs/claude-code/monitoring)
- [Claude Code 설정 문서](https://docs.anthropic.com/en/docs/claude-code/settings)
- [OpenTelemetry OTLP Exporter 설정 사양](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/protocol/exporter.md#configuration-options)
- [Claude Code Monitoring Implementation (Bedrock)](https://github.com/aws-solutions-library-samples/guidance-for-claude-code-with-amazon-bedrock/blob/main/assets/docs/MONITORING.md)
- [Claude Code ROI Measurement Guide](https://github.com/anthropics/claude-code-monitoring-guide)
