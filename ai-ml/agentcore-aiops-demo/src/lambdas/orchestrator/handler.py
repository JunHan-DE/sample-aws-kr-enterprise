"""Orchestrator Lambda — dispatches alarm to AgentCore asynchronously."""
import json
import os
import uuid
import logging
from datetime import datetime, timezone

import boto3
from botocore.config import Config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ddb = boto3.resource("dynamodb")
reports_table = ddb.Table(os.environ["REPORTS_TABLE"])
workloads_table = ddb.Table(os.environ["WORKLOADS_TABLE"])

AGENT_RUNTIME_ARN = os.environ.get("AGENT_RUNTIME_ARN", "")


def handler(event, context):
    logger.info("Event: %s", json.dumps(event, default=str))

    records = event.get("Records", [])
    eb_event = json.loads(records[0]["body"]) if records else event

    alarm_info = _parse_alarm(eb_event)
    if not alarm_info:
        return {"statusCode": 400}

    workload = _match_workload(alarm_info["alarm_name"])
    wid = workload.get("workload_id", "unknown") if workload else "unknown"
    report_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    workload_name = workload.get("name", "unregistered") if workload else "unregistered"

    # Step 1: Save ANALYZING placeholder
    alarm_data = {"name": alarm_info["alarm_name"], "resource": ", ".join(alarm_info.get("resources", [])), "triggered_at": alarm_info["timestamp"]}
    reports_table.put_item(Item={
        "report_id": report_id, "workload_id": wid, "alarm_name": alarm_info["alarm_name"],
        "created_at": created_at, "status": "ANALYZING",
        "report_data": {"report_id": report_id, "created_at": created_at, "workload": workload_name,
                        "alarm": alarm_data, "summary": "RCA 분석 중...", "status": "ANALYZING"},
    })
    logger.info(f"Report placeholder saved: {report_id}")

    # Step 2: Call AgentCore (async — returns immediately)
    if not AGENT_RUNTIME_ARN:
        logger.warning("AGENT_RUNTIME_ARN not configured")
        return {"statusCode": 200}

    workload_ctx = ""
    if workload:
        workload_ctx = f"\nWorkload: {workload.get('name', '')}\nDescription: {workload.get('description', '')}\n"

    prompt = (f"CloudWatch alarm triggered. Analyze and provide RCA.\n"
              f"Alarm: {alarm_info['alarm_name']}\nReason: {alarm_info['state_reason']}\n"
              f"Time: {alarm_info['timestamp']}\n{workload_ctx}\n"
              f"Use logs_agent, metrics_agent, infrastructure_agent, knowledge_agent to investigate.\n"
              f"Return ONLY valid JSON (no markdown).")

    payload = {
        "prompt": prompt, "agent": "rca",
        "report_id": report_id, "workload_id": wid, "workload_name": workload_name,
        "alarm": alarm_data,
        "notification": workload.get("notification", {}) if workload else {},
    }

    try:
        client = boto3.client("bedrock-agentcore", config=Config(read_timeout=15))
        resp = client.invoke_agent_runtime(
            agentRuntimeArn=AGENT_RUNTIME_ARN,
            runtimeSessionId=str(uuid.uuid4()),
            payload=json.dumps(payload).encode(),
        )
        # Read immediate response (async — agent returns quickly)
        response_body = resp.get("response")
        if response_body and hasattr(response_body, "read"):
            text = response_body.read().decode("utf-8")
        else:
            text = str(resp)
        logger.info(f"AgentCore async response: {text[:200]}")
    except Exception as e:
        logger.exception("AgentCore call failed")
        reports_table.update_item(
            Key={"report_id": report_id},
            UpdateExpression="SET report_data.summary = :s, report_data.#st = :st, #s = :st",
            ExpressionAttributeNames={"#st": "status", "#s": "status"},
            ExpressionAttributeValues={":s": f"분석 시작 실패: {e}", ":st": "FAILED"},
        )

    return {"statusCode": 200, "body": json.dumps({"report_id": report_id})}


def _parse_alarm(event):
    detail = event.get("detail", {})
    alarm_name = detail.get("alarmName", "")
    if not alarm_name:
        return None
    state = detail.get("state", {})
    config = detail.get("configuration", {})
    resources = []
    for m in config.get("metrics", []):
        dims = m.get("metricStat", {}).get("metric", {}).get("dimensions", {})
        resources.extend(dims.values())
    return {"alarm_name": alarm_name, "state_value": state.get("value", "ALARM"), "state_reason": state.get("reason", ""),
            "timestamp": state.get("timestamp", datetime.now(timezone.utc).isoformat()), "resources": resources}


def _match_workload(alarm_name):
    for w in workloads_table.scan().get("Items", []):
        for prefix in w.get("alarm_prefixes", []):
            if alarm_name.startswith(prefix):
                return w
    return None
