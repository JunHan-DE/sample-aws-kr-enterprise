"""WebSocket Chat Handler - no timeout limit."""
import json
import os
import uuid
import logging

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

AGENT_RUNTIME_ARN = os.environ.get("AGENT_RUNTIME_ARN", "")
WS_ENDPOINT = os.environ.get("WS_ENDPOINT", "")


def handler(event, context):
    route = event.get("requestContext", {}).get("routeKey", "")
    connection_id = event.get("requestContext", {}).get("connectionId", "")

    if route == "$connect":
        return {"statusCode": 200}
    elif route == "$disconnect":
        return {"statusCode": 200}
    elif route == "sendMessage":
        return _handle_message(event, connection_id)
    else:
        return {"statusCode": 400}


def _handle_message(event, connection_id):
    body = json.loads(event.get("body", "{}"))
    message = body.get("message", "")
    session_id = body.get("session_id", "")
    if not session_id or len(session_id) < 33:
        session_id = str(uuid.uuid4())

    apigw = boto3.client("apigatewaymanagementapi", endpoint_url=WS_ENDPOINT)

    def send(event_type, data):
        try:
            apigw.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps({"type": event_type, "data": data}).encode(),
            )
        except Exception as e:
            logger.warning(f"Send failed: {e}")

    if not message:
        send("error", "message required")
        return {"statusCode": 200}

    send("status", "🔍 에이전트 분석 시작...")

    if not AGENT_RUNTIME_ARN:
        send("response", f"AgentCore not configured. You asked: {message}")
        send("done", json.dumps({"session_id": session_id}))
        return {"statusCode": 200}

    # Retry on ConcurrencyException
    import time
    for attempt in range(3):
        try:
            send("status", "🤖 AI 분석 중..." if attempt == 0 else f"⏳ 재시도 {attempt}...")

            from botocore.config import Config
            client = boto3.client("bedrock-agentcore", config=Config(read_timeout=540))
            resp = client.invoke_agent_runtime(
                agentRuntimeArn=AGENT_RUNTIME_ARN,
                runtimeSessionId=session_id,
                payload=json.dumps({"prompt": message, "agent": "chatbot", "session_id": session_id}).encode(),
            )

            response_body = resp.get("response")
            if response_body and hasattr(response_body, "read"):
                text = response_body.read().decode("utf-8")
            else:
                text = str(resp.get("payload", ""))

            # Unwrap double-encoded JSON
            try:
                unwrapped = json.loads(text)
                if isinstance(unwrapped, str):
                    text = unwrapped
            except (json.JSONDecodeError, TypeError):
                pass

            send("response", text)
            send("done", json.dumps({"session_id": session_id}))
            return {"statusCode": 200}

        except Exception as e:
            err_str = str(e)
            if "ConcurrencyException" in err_str or "RuntimeClientError" in err_str or "500" in err_str:
                if attempt < 2:
                    send("status", "⏳ 이전 요청 처리 중, 잠시 후 재시도합니다...")
                    time.sleep(35)
                    continue
            logger.exception("Chat error")
            send("error", "에이전트 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
            return {"statusCode": 200}

    send("error", "에이전트가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.")
    return {"statusCode": 200}
