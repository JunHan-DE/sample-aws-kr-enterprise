# Context

## Current Goal

로컬 우선 LLM gateway PoC를 유지한다.

- 인증: 실제 Okta
- API: OpenAI-compatible
- 라우팅: LiteLLM
- 앱 운영 데이터: MySQL
- LiteLLM 내부 메타데이터: PostgreSQL

## Current Architecture

- `reverse-proxy/app.py`
  - Okta 로그인
  - 세션/내부 bearer token 발급
  - 사용자/팀 식별
  - audit log 기록
  - `/v1/*`를 LiteLLM로 프록시
- `litellm/config.yaml`
  - model alias
  - OpenAI / Ollama / Bedrock backend
- `docker-compose.yml`
  - `mysql`
  - `litellm-postgres`
  - `litellm`
  - `reverse-proxy`

## Decisions Locked

- 기본 리전: `ap-northeast-2`
- 표준 public API: `http://localhost:8080/v1`
- 인증 mock 사용 안 함
- Reverse Proxy는 인증/식별/audit만 담당
- budget, usage, key, provider routing은 LiteLLM 담당
- 모델 선택은 alias 기반
  - `default-fast`
  - `default-smart`
  - `oss-local`
  - `bedrock-sonnet`

## Required Env

- Okta
  - `OKTA_ISSUER`
  - `OKTA_CLIENT_ID`
  - `OKTA_CLIENT_SECRET`
  - `OKTA_SCOPES=openid profile email`
- Proxy
  - `SESSION_SECRET`
  - `TOKEN_SIGNING_SECRET`
- Providers
  - `OPENAI_API_KEY`
- Optional
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_SESSION_TOKEN`
  - `OLLAMA_API_BASE`

## Known Issues

- LiteLLM OSS Proxy는 MySQL DSN을 직접 지원하지 않음
  - 내부 Prisma datasource 때문에 PostgreSQL 필요
- `docker compose up --build` 검증 중 reverse-proxy의 `itsdangerous` 누락은 수정 완료
- `groups`는 OAuth scope가 아니라 claim으로 다루는 전제로 수정됨
- Okta 실제 값이 없으면 로그인 플로우는 아직 검증 불가

## Last Verified

- `python3 -m py_compile reverse-proxy/app.py` 통과
- `docker compose config` 통과
- `docker compose up --build` 직접 실행
- 확인됨:
  - LiteLLM healthy
  - MySQL healthy
  - LiteLLM PostgreSQL healthy
  - `GET http://localhost:4000/health/liveliness` -> `200`
  - `GET http://localhost:8080/healthz` -> `200`

## Next 3 Actions

1. `.env`에 실제 Okta / OpenAI 값 넣기
2. `http://localhost:8080/auth/login`으로 실제 Okta 로그인 검증
3. `/auth/cli-token`, `/v1/models`, `/v1/chat/completions` 실제 호출 검증

## Key Files

- [README.md](/Users/ME/Desktop/Codebase/sample-aws-kr-enterprise/ai-ml/claude-code-bedrock-enterprise-blueprint/README.md)
- [docker-compose.yml](/Users/ME/Desktop/Codebase/sample-aws-kr-enterprise/ai-ml/claude-code-bedrock-enterprise-blueprint/docker-compose.yml)
- [reverse-proxy/app.py](/Users/ME/Desktop/Codebase/sample-aws-kr-enterprise/ai-ml/claude-code-bedrock-enterprise-blueprint/reverse-proxy/app.py)
- [litellm/config.yaml](/Users/ME/Desktop/Codebase/sample-aws-kr-enterprise/ai-ml/claude-code-bedrock-enterprise-blueprint/litellm/config.yaml)
- [mysql/init/001-schema.sql](/Users/ME/Desktop/Codebase/sample-aws-kr-enterprise/ai-ml/claude-code-bedrock-enterprise-blueprint/mysql/init/001-schema.sql)
