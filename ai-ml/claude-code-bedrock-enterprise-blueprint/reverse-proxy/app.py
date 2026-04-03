import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt
from authlib.integrations.starlette_client import OAuth
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse, StreamingResponse
from sqlalchemy import DateTime, Integer, String, Text, create_engine
from sqlalchemy.dialects.mysql import JSON as MySQLJSON
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from starlette.background import BackgroundTask
from starlette.middleware.sessions import SessionMiddleware


def _env(name: str, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if value is None:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


APP_REGION = os.getenv("APP_REGION", "ap-northeast-2")
PROXY_HOST = os.getenv("PROXY_HOST", "0.0.0.0")
PROXY_PORT = int(os.getenv("PROXY_PORT", "8080"))
PROXY_PUBLIC_URL = os.getenv("PROXY_PUBLIC_URL", f"http://localhost:{PROXY_PORT}")
DATABASE_URL = _env("DATABASE_URL")
SESSION_SECRET = _env("SESSION_SECRET")
TOKEN_SIGNING_SECRET = _env("TOKEN_SIGNING_SECRET")
TOKEN_TTL_SECONDS = int(os.getenv("TOKEN_TTL_SECONDS", "28800"))
LITELLM_BASE_URL = os.getenv("LITELLM_BASE_URL", "http://litellm:4000").rstrip("/")
LITELLM_MASTER_KEY = _env("LITELLM_MASTER_KEY")
OKTA_ISSUER = _env("OKTA_ISSUER")
OKTA_CLIENT_ID = _env("OKTA_CLIENT_ID")
OKTA_CLIENT_SECRET = _env("OKTA_CLIENT_SECRET")
OKTA_SCOPES = os.getenv("OKTA_SCOPES", "openid profile email")
OKTA_GROUP_CLAIM = os.getenv("OKTA_GROUP_CLAIM", "groups")
OKTA_TEAM_PREFIX = os.getenv("OKTA_TEAM_PREFIX", "")


class Base(DeclarativeBase):
    pass


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    session_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    team_id: Mapped[str] = mapped_column(String(255), nullable=False)
    groups_json: Mapped[dict[str, Any] | list[str] | None] = mapped_column(MySQLJSON, nullable=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    source_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    audit_id: Mapped[str] = mapped_column(String(64), nullable=False)
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    team_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    method: Mapped[str] = mapped_column(String(16), nullable=False)
    path: Mapped[str] = mapped_column(String(512), nullable=False)
    model_alias: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_hint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    request_body_json: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(MySQLJSON, nullable=True)
    response_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(engine)


app = FastAPI(title="Claude Code Reverse Proxy", version="0.1.0")
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, same_site="lax", https_only=False)

oauth = OAuth()
oauth.register(
    name="okta",
    client_id=OKTA_CLIENT_ID,
    client_secret=OKTA_CLIENT_SECRET,
    server_metadata_url=f"{OKTA_ISSUER.rstrip('/')}/.well-known/openid-configuration",
    client_kwargs={"scope": OKTA_SCOPES},
)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _pick_team(groups: list[str]) -> str:
    if not groups:
        return "default"
    if OKTA_TEAM_PREFIX:
        for group in groups:
            if group.startswith(OKTA_TEAM_PREFIX):
                return group[len(OKTA_TEAM_PREFIX):] or "default"
    return groups[0]


def _issue_internal_token(session_data: dict[str, Any]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": session_data["user_id"],
        "email": session_data["email"],
        "team_id": session_data["team_id"],
        "session_id": session_data["session_id"],
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=TOKEN_TTL_SECONDS)).timestamp()),
        "iss": "reverse-proxy",
    }
    return jwt.encode(payload, TOKEN_SIGNING_SECRET, algorithm="HS256")


def _decode_internal_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, TOKEN_SIGNING_SECRET, algorithms=["HS256"], issuer="reverse-proxy")


def _build_callback_url() -> str:
    return f"{PROXY_PUBLIC_URL.rstrip('/')}/auth/callback"


def _get_session_payload(request: Request) -> dict[str, Any] | None:
    payload = request.session.get("user")
    return payload if isinstance(payload, dict) else None


def _serialize_body(body: bytes, content_type: str | None) -> dict[str, Any] | list[Any] | None:
    if not body:
        return None
    if not content_type or "application/json" not in content_type:
        return None
    try:
        return json.loads(body.decode("utf-8"))
    except Exception:
        return None


def _extract_user_context(request: Request) -> dict[str, Any]:
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        try:
            claims = _decode_internal_token(token)
            return {
                "user_id": claims["sub"],
                "email": claims["email"],
                "team_id": claims["team_id"],
                "session_id": claims["session_id"],
            }
        except jwt.PyJWTError as exc:
            raise HTTPException(status_code=401, detail=f"invalid bearer token: {exc}") from exc

    payload = _get_session_payload(request)
    if payload:
        return payload

    raise HTTPException(status_code=401, detail="authentication required")


def _write_audit_log(
    db: Session,
    *,
    audit_id: str,
    user_context: dict[str, Any] | None,
    request: Request,
    request_json: dict[str, Any] | list[Any] | None,
    status_code: int | None = None,
    response_error: str | None = None,
) -> None:
    model_alias = None
    if isinstance(request_json, dict):
        maybe_model = request_json.get("model")
        if isinstance(maybe_model, str):
            model_alias = maybe_model

    record = AuditLog(
        audit_id=audit_id,
        session_id=user_context.get("session_id") if user_context else None,
        user_id=user_context.get("user_id") if user_context else None,
        email=user_context.get("email") if user_context else None,
        team_id=user_context.get("team_id") if user_context else None,
        method=request.method,
        path=request.url.path,
        model_alias=model_alias,
        provider_hint=None,
        status_code=status_code,
        request_body_json=request_json,
        response_error=response_error,
    )
    db.add(record)
    db.commit()


def _proxy_headers(request: Request, user_context: dict[str, Any], audit_id: str) -> dict[str, str]:
    headers: dict[str, str] = {}
    for key, value in request.headers.items():
        lower = key.lower()
        if lower in {"host", "content-length", "authorization", "cookie"}:
            continue
        headers[key] = value

    headers["Authorization"] = f"Bearer {LITELLM_MASTER_KEY}"
    headers["X-User-Id"] = user_context["user_id"]
    headers["X-User-Email"] = user_context["email"]
    headers["X-Team-Id"] = user_context["team_id"]
    headers["X-Session-Id"] = user_context["session_id"]
    headers["X-Audit-Id"] = audit_id
    headers["X-Region"] = APP_REGION
    return headers


async def _proxy_to_litellm(
    request: Request,
    upstream_path: str,
    user_context: dict[str, Any],
    db: Session,
) -> Response:
    audit_id = secrets.token_hex(16)
    body = await request.body()
    request_json = _serialize_body(body, request.headers.get("content-type"))
    headers = _proxy_headers(request, user_context, audit_id)
    query = dict(request.query_params)
    url = f"{LITELLM_BASE_URL.rstrip('/')}{upstream_path}"
    if query:
        url = f"{url}?{urlencode(query, doseq=True)}"

    client = httpx.AsyncClient(timeout=None)
    upstream_request = client.build_request(
        request.method,
        url,
        headers=headers,
        content=body,
    )

    try:
        upstream_response = await client.send(upstream_request, stream=True)
    except httpx.HTTPError as exc:
        _write_audit_log(
            db,
            audit_id=audit_id,
            user_context=user_context,
            request=request,
            request_json=request_json,
            status_code=502,
            response_error=str(exc),
        )
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"upstream request failed: {exc}") from exc

    _write_audit_log(
        db,
        audit_id=audit_id,
        user_context=user_context,
        request=request,
        request_json=request_json,
        status_code=upstream_response.status_code,
        response_error=None if upstream_response.status_code < 400 else "upstream returned error",
    )

    response_headers = {
        key: value
        for key, value in upstream_response.headers.items()
        if key.lower() not in {"content-length", "transfer-encoding", "connection"}
    }

    async def _iterator():
        async for chunk in upstream_response.aiter_raw():
            yield chunk

    return StreamingResponse(
        _iterator(),
        status_code=upstream_response.status_code,
        headers=response_headers,
        media_type=upstream_response.headers.get("content-type"),
        background=BackgroundTask(_close_upstream, upstream_response, client),
    )


async def _close_upstream(upstream_response: httpx.Response, client: httpx.AsyncClient) -> None:
    await upstream_response.aclose()
    await client.aclose()


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def home(request: Request) -> dict[str, Any]:
    payload = _get_session_payload(request)
    return {
        "service": "reverse-proxy",
        "authenticated": bool(payload),
        "login_url": f"{PROXY_PUBLIC_URL.rstrip('/')}/auth/login",
        "models_url": f"{PROXY_PUBLIC_URL.rstrip('/')}/v1/models",
    }


@app.get("/auth/login")
async def auth_login(request: Request):
    redirect_uri = _build_callback_url()
    return await oauth.okta.authorize_redirect(request, redirect_uri)


@app.get("/auth/callback")
async def auth_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.okta.authorize_access_token(request)
    userinfo = token.get("userinfo")
    if not userinfo:
        userinfo = await oauth.okta.userinfo(token=token)

    groups = userinfo.get(OKTA_GROUP_CLAIM) or []
    if not isinstance(groups, list):
        groups = []

    user_id = userinfo.get("preferred_username") or userinfo.get("sub") or userinfo.get("email")
    email = userinfo.get("email") or f"{user_id}@unknown.local"
    team_id = _pick_team(groups)
    session_id = secrets.token_hex(24)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=TOKEN_TTL_SECONDS)

    payload = {
        "user_id": user_id,
        "email": email,
        "team_id": team_id,
        "session_id": session_id,
    }
    request.session["user"] = payload

    record = AuthSession(
        session_id=session_id,
        user_id=user_id,
        email=email,
        team_id=team_id,
        groups_json=groups,
        expires_at=expires_at,
        user_agent=request.headers.get("user-agent"),
        source_ip=request.client.host if request.client else None,
    )
    db.merge(record)
    db.commit()

    response = RedirectResponse(url="/auth/cli-token")
    return response


@app.get("/auth/me")
def auth_me(request: Request):
    payload = _get_session_payload(request)
    if not payload:
        raise HTTPException(status_code=401, detail="authentication required")
    return payload


@app.get("/auth/token")
def auth_token(request: Request):
    payload = _get_session_payload(request)
    if not payload:
        raise HTTPException(status_code=401, detail="browser session required")
    token = _issue_internal_token(payload)
    if request.query_params.get("format") == "text":
        return PlainTextResponse(token)
    return {"token": token, "expires_in": TOKEN_TTL_SECONDS}


@app.get("/auth/cli-token")
def auth_cli_token(request: Request):
    payload = _get_session_payload(request)
    if not payload:
        raise HTTPException(status_code=401, detail="browser session required")
    token = _issue_internal_token(payload)
    return HTMLResponse(
        f"""
        <html>
          <body style="font-family: sans-serif; padding: 2rem;">
            <h1>Gateway API Token</h1>
            <p>아래 토큰을 복사해 <code>GATEWAY_API_TOKEN</code> 또는 <code>~/.claude/gateway-token</code>에 저장하세요.</p>
            <pre style="white-space: pre-wrap; word-break: break-all; background: #f4f4f4; padding: 1rem;">{token}</pre>
            <p>SDK base URL: <code>{PROXY_PUBLIC_URL.rstrip('/')}/v1</code></p>
          </body>
        </html>
        """
    )


@app.post("/auth/logout")
def auth_logout(request: Request):
    request.session.clear()
    return {"ok": True}


@app.api_route("/v1/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def openai_proxy(path: str, request: Request, db: Session = Depends(get_db)):
    user_context = _extract_user_context(request)
    return await _proxy_to_litellm(request, f"/{path}", user_context, db)
