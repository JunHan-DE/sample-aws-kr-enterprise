#!/bin/bash
# setup-developer.sh
# Local-first Okta + LiteLLM 개발 환경 준비 스크립트

set -euo pipefail

echo "============================================"
echo " Claude Code Gateway - 개발자 설정"
echo "============================================"
echo ""

echo "[1/4] Docker 설치 확인..."
if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker 가 설치되어 있지 않습니다." >&2
  exit 1
fi
echo "  설치됨: $(docker --version)"
echo ""

echo "[2/4] docker compose 확인..."
if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose 를 사용할 수 없습니다." >&2
  exit 1
fi
echo "  설치됨: $(docker compose version --short)"
echo ""

echo "[3/4] .env 파일 확인..."
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "  .env.example 을 복사해 .env 를 생성했습니다."
else
  echo "  .env 파일이 이미 존재합니다."
fi
echo "  아래 값을 반드시 채우세요:"
echo "    - OKTA_ISSUER"
echo "    - OKTA_CLIENT_ID"
echo "    - OKTA_CLIENT_SECRET"
echo "    - SESSION_SECRET"
echo "    - TOKEN_SIGNING_SECRET"
echo "    - OPENAI_API_KEY"
echo ""

echo "[4/4] 기동 안내..."
echo "  docker compose up --build"
echo ""
echo "  기동 후 브라우저에서 로그인:"
echo "    http://localhost:8080/auth/login"
echo ""
echo "  로그인 후 /auth/cli-token 페이지에서 내부 API 토큰을 복사하세요."
echo "  그리고 ~/.claude/gateway-token 파일에 저장하세요."
echo ""

echo "============================================"
echo " 설정 안내 완료"
echo "============================================"
