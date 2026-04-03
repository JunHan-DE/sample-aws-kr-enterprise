#!/bin/bash
# This script returns a previously issued internal bearer token.
# Login is performed in the browser against the real Okta server.

set -euo pipefail

TOKEN_FILE="${TOKEN_FILE:-$HOME/.claude/gateway-token}"

if [ -n "${GATEWAY_API_TOKEN:-}" ]; then
  echo "$GATEWAY_API_TOKEN"
  exit 0
fi

if [ ! -f "$TOKEN_FILE" ]; then
  echo "ERROR: token file not found: $TOKEN_FILE" >&2
  echo "브라우저에서 실제 Okta 로그인 후 아래 페이지에서 토큰을 복사해 저장하세요:" >&2
  echo "  http://localhost:8080/auth/login" >&2
  echo "로그인 완료 후 표시되는 토큰을 다음 파일에 저장하세요:" >&2
  echo "  $TOKEN_FILE" >&2
  exit 1
fi

cat "$TOKEN_FILE"
