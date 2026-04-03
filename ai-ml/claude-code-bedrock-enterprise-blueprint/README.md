# Claude Code Gateway on LiteLLM

로컬 우선 PoC를 위한 멀티-provider LLM 게이트웨이 샘플입니다. 이 프로젝트는 기존의 `AWS IAM Identity Center + Bedrock 전용` 구성에서 벗어나, `Okta SSO + Reverse Proxy + LiteLLM + MySQL` 조합으로 재설계되었습니다. 다만 LiteLLM OSS Proxy의 내부 Prisma 제약 때문에 LiteLLM 메타데이터 저장소로는 별도 PostgreSQL을 사용합니다.

핵심 원칙은 아래와 같습니다.

- `Reverse Proxy`
  - Okta 인증 상태 확인
  - 세션 또는 내부 토큰 발급/검증
  - 사용자/팀 식별
  - audit log 기록
- `LiteLLM OSS`
  - OpenAI-compatible API 제공
  - provider/model alias 관리
  - virtual key, budget control, usage tracking
  - OpenAI / Bedrock / Ollama 호출
- `MySQL`
  - audit log, 세션 메타데이터, 모델 카탈로그 등 애플리케이션 운영 데이터 저장
- `PostgreSQL`
  - LiteLLM OSS Proxy 내부 메타데이터 저장

## 현재 기본 아키텍처

```text
Client SDK / Claude Code SDK / OpenAI SDK
            |
            v
     Reverse Proxy (FastAPI)
       - Okta OIDC/SAML login
       - session/internal token
       - user/team extraction
       - audit logging
            |
            v
           LiteLLM
       - OpenAI-compatible API
       - model alias -> provider routing
       - budget / usage / key management
            |
            +--> OpenAI
            +--> Amazon Bedrock
            +--> Ollama (ollama.coupangpay.net)

MySQL
  - auth_sessions
  - audit_logs
  - model_catalog
  - provider_config

PostgreSQL
  - LiteLLM proxy internal tables
```

## 무엇이 바뀌었나

- 기본 실행 경로를 AWS CDK 배포가 아닌 `Docker Compose 기반 local-first`로 전환
- 인증을 IAM Identity Center에서 `Okta`로 전환
- 표준 public API를 `OpenAI-compatible endpoint`로 전환
- 사용자 모델 선택을 `LiteLLM model alias` 기반으로 전환
- 기본 리전을 `ap-northeast-2`로 통일
- 기존 AWS/CDK 자산은 참고용 `legacy` 취급

## 디렉터리 구조

```text
.
├── docker-compose.yml
├── .env.example
├── litellm-postgres/
│   └── Docker volume only
├── mysql/
│   └── init/
│       └── 001-schema.sql
├── reverse-proxy/
│   ├── Dockerfile
│   ├── app.py
│   └── requirements.txt
├── litellm/
│   ├── config.yaml
│   └── custom_callbacks/
├── scripts/
│   ├── setup-developer.sh
│   └── get-openai-token.sh
├── templates/
│   ├── claude-settings.json
│   └── aws-config-template.ini
└── lib/, lambda/
    └── 기존 AWS/CDK 자산 (legacy reference)
```

## 빠른 시작

### 1. 환경 변수 준비

```bash
cp .env.example .env
```

필수 값:

- `OKTA_ISSUER`
- `OKTA_CLIENT_ID`
- `OKTA_CLIENT_SECRET`
- `SESSION_SECRET`
- `TOKEN_SIGNING_SECRET`
- `LITELLM_MASTER_KEY`

Okta scope 기본값은 아래처럼 둡니다.

```env
OKTA_SCOPES=openid profile email
```

`groups`는 scope가 아니라 claim으로 처리하는 것이 일반적이므로 `OKTA_SCOPES`에 넣지 않습니다. 그룹 정보가 필요하면 Okta authorization server에서 `groups` claim을 토큰에 추가하고 `OKTA_GROUP_CLAIM=groups`를 유지하세요.

LiteLLM Admin UI에서 Okta SSO를 함께 쓰려면 아래 값도 채웁니다.

```env
LITELLM_SSO_TYPE=okta
LITELLM_OKTA_DOMAIN=https://example.okta.com
LITELLM_OKTA_CLIENT_ID=your-litellm-okta-client-id
LITELLM_OKTA_CLIENT_SECRET=your-litellm-okta-client-secret
LITELLM_OKTA_SCOPES=openid email profile
```

`OPENAI_API_KEY`는 `default-fast`, `default-smart` 같은 OpenAI backend alias를 실제로 호출할 때만 필요합니다. 브라우저에서 `/auth/cli-token` 페이지로 발급받는 토큰과는 다른 값입니다.

선택 값:

- `OPENAI_API_KEY`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`
- `BEDROCK_MODEL_ID`
- `OLLAMA_API_BASE`

## 2. 로컬 스택 기동

```bash
docker compose up --build
```

기본 포트:

- Reverse Proxy: `http://localhost:8080`
- LiteLLM: `http://localhost:4000`
- LiteLLM Admin UI: `http://localhost:4000/ui/`
- MySQL: `localhost:3306`
- LiteLLM PostgreSQL: `localhost:5432`

## 3. Reverse Proxy 연동

이 경로는 애플리케이션/SDK 사용자를 위한 public API 진입점입니다.

### 3.1 Reverse Proxy용 Okta 웹 로그인

브라우저에서 아래 URL로 접속합니다.

```text
http://localhost:8080/auth/login
```

로그인이 성공하면 Reverse Proxy가 세션을 만들고 `/auth/cli-token`으로 이동합니다. 이 페이지에 표시되는 내부 bearer token을 CLI/SDK에서 사용합니다.

### 3.2 CLI/SDK용 내부 토큰 발급

브라우저 로그인 후 `/auth/cli-token` 페이지에 표시되는 토큰을 아래 파일에 저장합니다.

```bash
mkdir -p ~/.claude
printf '%s\n' 'PASTE_TOKEN_HERE' > ~/.claude/gateway-token
```

그 다음 아래 명령으로 토큰을 읽어 SDK에서 사용합니다.

```bash
./scripts/get-openai-token.sh
```

### 3.3 OpenAI-compatible API 호출

```bash
export OPENAI_BASE_URL=http://localhost:8080/v1
export OPENAI_API_KEY="$(./scripts/get-openai-token.sh)"
```

예시:

```bash
curl http://localhost:8080/v1/models \
  -H "Authorization: Bearer ${OPENAI_API_KEY}"
```

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer ${OPENAI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "default-fast",
    "messages": [
      {"role": "user", "content": "hello"}
    ]
  }'
```

중요:

- 여기서 `OPENAI_API_KEY`라는 셸 변수에는 Reverse Proxy가 발급한 내부 bearer token을 넣습니다.
- 이 값은 LiteLLM/OpenAI provider가 사용하는 실제 provider secret과 다릅니다.
- `default-fast`, `default-smart`를 쓰려면 서버 `.env`의 `OPENAI_API_KEY`에도 실제 OpenAI 키가 있어야 합니다.

## 제공 모델 alias

초기 LiteLLM 설정은 아래 alias를 제공합니다.

- `default-fast` -> OpenAI 기본 빠른 모델
- `default-smart` -> OpenAI 기본 고성능 모델
- `oss-local` -> Ollama endpoint
- `bedrock-sonnet` -> Bedrock Claude 계열 예시

실제 backend 매핑은 [litellm/config.yaml](/Users/ME/Desktop/Codebase/sample-aws-kr-enterprise/ai-ml/claude-code-bedrock-enterprise-blueprint/litellm/config.yaml)에서 조정합니다.

### 3.4 Reverse Proxy 인증 흐름

1. `/auth/login`에서 Okta 로그인으로 리다이렉트
2. `/auth/callback`에서 authorization code를 처리
3. 사용자와 그룹/팀 정보를 세션에 저장
4. 세션 기반으로 `/auth/cli-token` 페이지에서 내부 bearer token 확인
5. API 요청 시 Reverse Proxy가 토큰 검증 후 LiteLLM에 사용자 컨텍스트 전달

LiteLLM으로 전달되는 내부 헤더:

- `X-User-Id`
- `X-User-Email`
- `X-Team-Id`
- `X-Session-Id`
- `X-Audit-Id`

## 4. LiteLLM Admin UI 연동

이 경로는 운영자/관리자가 LiteLLM Admin UI에 로그인하는 흐름입니다. Reverse Proxy의 `/auth/login`과는 별도입니다.

현재 프로젝트에서는 `LITELLM_OKTA_*` 값을 Docker Compose에서 LiteLLM의 generic SSO 변수로 매핑해 Okta SSO를 연결합니다.

### 4.1 LiteLLM Admin UI용 Okta 설정

`.env`에 아래 값을 채웁니다.

```env
LITELLM_SSO_TYPE=okta
LITELLM_OKTA_DOMAIN=https://example.okta.com
LITELLM_OKTA_CLIENT_ID=your-litellm-okta-client-id
LITELLM_OKTA_CLIENT_SECRET=your-litellm-okta-client-secret
LITELLM_OKTA_SCOPES=openid email profile
```

현재 Docker Compose는 위 값을 LiteLLM이 읽는 아래 generic SSO 값으로 넘깁니다.

- `GENERIC_CLIENT_ID`
- `GENERIC_CLIENT_SECRET`
- `GENERIC_AUTHORIZATION_ENDPOINT`
- `GENERIC_TOKEN_ENDPOINT`
- `GENERIC_USERINFO_ENDPOINT`

### 4.2 LiteLLM Admin UI용 Okta 웹 로그인

브라우저에서 아래 주소로 접속합니다.

```text
http://localhost:4000/ui/
```

LiteLLM UI가 SSO 설정을 감지하면 로그인 흐름에서 `/sso/key/generate`를 통해 Okta authorize endpoint로 이동합니다.

직접 확인용 엔드포인트:

```text
http://localhost:4000/sso/key/generate
```

현재 로컬 검증 기준으로 위 엔드포인트는 Okta authorize URL로 `303` 리다이렉트되며, LiteLLM의 `/sso/readiness`도 healthy 상태입니다.

### 4.3 LiteLLM Admin UI Okta 앱 설정 시 주의사항

- `redirect_uri`는 LiteLLM callback URL인 `http://localhost:4000/sso/callback`을 허용해야 합니다.
- `LITELLM_OKTA_DOMAIN`은 실제 Okta authorization server 기준으로 맞춰야 합니다.
- Okta org authorization server를 쓰면 예시는 `https://your-org.okta.com` 입니다.
- Okta custom authorization server를 쓰면 예시는 `https://your-org.okta.com/oauth2/default` 입니다.

예를 들어 custom authorization server를 쓰는데 `LITELLM_OKTA_DOMAIN=https://your-org.okta.com` 만 넣으면 LiteLLM은 `.../oauth2/v1/*`를 사용합니다. 반대로 `https://your-org.okta.com/oauth2/default` 를 넣으면 `.../oauth2/default/v1/*`를 사용합니다.

## 저장소 구성

애플리케이션 기준 운영 데이터는 MySQL에 저장합니다.

- `auth_sessions`
- `audit_logs`
- `model_catalog`
- `provider_config`

LiteLLM 자체 테이블은 별도 PostgreSQL 컨테이너를 사용합니다. 이는 LiteLLM OSS Proxy가 현재 Prisma datasource를 PostgreSQL로 기대하기 때문입니다.

## Claude Code SDK / 기타 SDK 연동

이 프로젝트는 특정 Claude provider에 종속되지 않습니다. `Claude Code SDK`도 여기서는 단지 클라이언트 SDK이며, 표준 public API는 OpenAI-compatible endpoint입니다.

권장 방식:

- base URL: `http://localhost:8080/v1`
- API key: Reverse Proxy가 발급한 내부 bearer token
- model: LiteLLM alias (`default-fast`, `oss-local`, `bedrock-sonnet` 등)

즉 `Claude Code / SDK -> Reverse Proxy -> LiteLLM` 흐름에서는 사용자별 고유 토큰은 Reverse Proxy가 발급한 내부 bearer token이고, 실제 OpenAI/Bedrock/Ollama provider credential은 서버 측에서 중앙 관리합니다.

## Legacy 자산

기존 아래 자산은 더 이상 기본 경로가 아닙니다.

- `lib/stacks/*`
- `lambda/token-service/*`
- `scripts/get-gateway-token.sh`
- 기존 Bedrock/IAM Identity Center 문서

필요 시 참고용으로만 유지합니다.
