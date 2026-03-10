import json
import os
import uuid
import logging
from datetime import datetime, timezone
from decimal import Decimal

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ddb = boto3.resource("dynamodb")
reports_table = ddb.Table(os.environ["REPORTS_TABLE"])
workloads_table = ddb.Table(os.environ["WORKLOADS_TABLE"])
snapshots_table = ddb.Table(os.environ["SNAPSHOTS_TABLE"])
s3_client = boto3.client("s3")
cw_client = boto3.client("cloudwatch")
ec2_client = boto3.client("ec2")
asg_client = boto3.client("autoscaling")

KNOWLEDGE_BUCKET = os.environ.get("KNOWLEDGE_BUCKET", "")
AGENT_RUNTIME_ARN = os.environ.get("AGENT_RUNTIME_ARN", "")


def handler(event, context):
    method = event.get("httpMethod", "GET")
    path = event.get("path", "")
    params = event.get("pathParameters", {}) or {}

    try:
        # Workloads
        if path == "/api/workloads" and method == "GET":
            return _list_workloads()
        if path == "/api/workloads" and method == "POST":
            return _create_workload(event)
        if "/api/workloads/" in path and "/upload-url" in path and method == "POST":
            return _get_upload_url(params.get("workload_id", ""), event)
        if "/api/workloads/" in path and "/documents" in path and method == "GET":
            return _list_documents(params.get("workload_id", ""))
        if "/api/workloads/" in path and "/documents" in path and method == "DELETE":
            return _delete_document(params.get("workload_id", ""), event)
        if "/api/workloads/" in path and "/sync" in path and method == "POST":
            return _sync_kb()
        if "/api/workloads/" in path and method == "GET":
            return _get_workload(params.get("workload_id", ""))
        if "/api/workloads/" in path and method == "PUT":
            return _update_workload(params.get("workload_id", ""), event)
        if "/api/workloads/" in path and method == "DELETE":
            return _delete_workload(params.get("workload_id", ""))

        # Reports
        if path == "/api/reports" and method == "GET":
            return _list_reports()
        if "/api/reports/" in path and "/approve" in path and method == "POST":
            return _approve_action(params.get("id", ""), event)
        if "/api/reports/" in path and method == "DELETE":
            return _delete_report(params.get("id", ""))
        if "/api/reports/" in path and method == "GET":
            return _get_report(params.get("id", ""))

        # Status & Chat
        if path == "/api/status" and method == "GET":
            return _get_status()
        if path == "/api/chat" and method == "POST":
            return _chat(event)

        return _resp(404, {"error": "Not found"})
    except Exception as e:
        logger.exception("API error")
        return _resp(500, {"error": str(e)})


# ========== Workloads ==========

def _list_workloads():
    items = workloads_table.scan().get("Items", [])
    return _resp(200, _dec(items))


def _get_workload(wid):
    item = workloads_table.get_item(Key={"workload_id": wid}).get("Item")
    return _resp(200, _dec(item)) if item else _resp(404, {"error": "Not found"})


def _create_workload(event):
    body = json.loads(event.get("body", "{}"))
    wid = body.get("workload_id", str(uuid.uuid4())[:8])
    item = {
        "workload_id": wid,
        "name": body.get("name", wid),
        "description": body.get("description", ""),
        "alarm_prefixes": body.get("alarm_prefixes", []),
        "notification": body.get("notification", {}),
        "resources": body.get("resources", {}),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    workloads_table.put_item(Item=item)
    return _resp(201, _dec(item))


def _update_workload(wid, event):
    body = json.loads(event.get("body", "{}"))
    expr_parts, names, values = [], {}, {}
    for key in ["name", "description", "alarm_prefixes", "notification", "resources"]:
        if key in body:
            safe = key.replace("_", "")
            expr_parts.append(f"#{safe} = :{safe}")
            names[f"#{safe}"] = key
            values[f":{safe}"] = body[key]
    if not expr_parts:
        return _resp(400, {"error": "No fields to update"})
    workloads_table.update_item(
        Key={"workload_id": wid},
        UpdateExpression="SET " + ", ".join(expr_parts),
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )
    return _resp(200, {"status": "updated"})


def _delete_workload(wid):
    workloads_table.delete_item(Key={"workload_id": wid})
    return _resp(200, {"status": "deleted"})


def _get_upload_url(wid, event):
    body = json.loads(event.get("body", "{}"))
    filename = body.get("filename", "document.md")
    key = f"workloads/{wid}/{filename}"
    url = s3_client.generate_presigned_url(
        "put_object",
        Params={"Bucket": KNOWLEDGE_BUCKET, "Key": key, "ContentType": body.get("content_type", "application/octet-stream")},
        ExpiresIn=3600,
    )
    return _resp(200, {"upload_url": url, "s3_key": key})


def _list_documents(wid):
    prefix = f"workloads/{wid}/"
    resp = s3_client.list_objects_v2(Bucket=KNOWLEDGE_BUCKET, Prefix=prefix)
    files = [{"key": obj["Key"], "name": obj["Key"].split("/")[-1],
              "size": obj["Size"], "last_modified": obj["LastModified"].isoformat()}
             for obj in resp.get("Contents", []) if obj["Key"] != prefix]
    return _resp(200, {"documents": files})


def _delete_document(wid, event):
    body = json.loads(event.get("body", "{}"))
    key = body.get("key", "")
    if not key or not key.startswith(f"workloads/{wid}/"):
        return _resp(400, {"error": "Invalid key"})
    s3_client.delete_object(Bucket=KNOWLEDGE_BUCKET, Key=key)
    return _resp(200, {"deleted": key})


def _sync_kb():
    kb_id = os.environ.get("KNOWLEDGE_BASE_ID", "")
    ds_id = os.environ.get("KB_DATA_SOURCE_ID", "")
    if not kb_id or not ds_id:
        return _resp(400, {"error": "Knowledge Base not configured"})
    bedrock_client = boto3.client("bedrock-agent")
    # Check if there's already a running job
    try:
        jobs = bedrock_client.list_ingestion_jobs(
            knowledgeBaseId=kb_id, dataSourceId=ds_id,
            sortBy={"attribute": "STARTED_AT", "order": "DESCENDING"}, maxResults=1,
        )
        items = jobs.get("ingestionJobSummaries", [])
        if items and items[0].get("status") == "IN_PROGRESS":
            job = items[0]
            return _resp(200, {"status": "IN_PROGRESS", "job_id": job.get("ingestionJobId"),
                               "started_at": job.get("startedAt", "").isoformat() if hasattr(job.get("startedAt", ""), "isoformat") else str(job.get("startedAt", "")),
                               "statistics": job.get("statistics", {})})
    except Exception:
        pass
    # Start new job
    resp = bedrock_client.start_ingestion_job(knowledgeBaseId=kb_id, dataSourceId=ds_id)
    job = resp.get("ingestionJob", {})
    return _resp(200, {"status": job.get("status", "STARTING"), "job_id": job.get("ingestionJobId")})


# ========== Reports ==========

def _list_reports():
    items = sorted(reports_table.scan().get("Items", []), key=lambda x: x.get("created_at", ""), reverse=True)
    return _resp(200, _dec(items[:50]))


def _delete_report(rid):
    reports_table.delete_item(Key={"report_id": rid})
    return _resp(200, {"deleted": rid})


def _get_report(rid):
    item = reports_table.get_item(Key={"report_id": rid}).get("Item")
    return _resp(200, _dec(item)) if item else _resp(404, {"error": "Not found"})


def _approve_action(rid, event):
    body = json.loads(event.get("body", "{}"))
    action_id = body.get("action_id", "")
    item = reports_table.get_item(Key={"report_id": rid}).get("Item")
    if not item:
        return _resp(404, {"error": "Not found"})
    rd = item.get("report_data", {})
    action = None
    for a in rd.get("recommended_actions", []):
        if a.get("action_id") == action_id:
            a["status"] = "EXECUTING"
            action = a
            break
    if not action:
        return _resp(404, {"error": "Action not found"})

    # Save EXECUTING status
    reports_table.update_item(Key={"report_id": rid}, UpdateExpression="SET report_data = :rd",
                              ExpressionAttributeValues={":rd": rd})

    # Call Executor Agent (async — returns immediately)
    if AGENT_RUNTIME_ARN:
        try:
            from botocore.config import Config
            client = boto3.client("bedrock-agentcore", config=Config(read_timeout=15))
            prompt = (f"Execute this approved action:\n"
                      f"Action ID: {action.get('action_id')}\n"
                      f"Description: {action.get('description')}\n"
                      f"Command: {action.get('command', 'N/A')}\n"
                      f"Code: {action.get('code', 'N/A')}\n"
                      f"Risk Level: {action.get('risk_level', 'UNKNOWN')}")
            payload = {
                "prompt": prompt, "agent": "executor",
                "report_id": rid, "action_id": action_id,
            }
            resp = client.invoke_agent_runtime(
                agentRuntimeArn=AGENT_RUNTIME_ARN, runtimeSessionId=str(uuid.uuid4()),
                payload=json.dumps(payload).encode())
            response_body = resp.get("response")
            if response_body and hasattr(response_body, "read"):
                response_body.read()  # consume response
        except Exception as e:
            logger.exception("Executor call failed")
            # Mark as failed immediately
            for a in rd.get("recommended_actions", []):
                if a.get("action_id") == action_id:
                    a["status"] = "FAILED"
                    a["execution_result"] = f"실행 시작 실패: {e}"
            reports_table.update_item(Key={"report_id": rid}, UpdateExpression="SET report_data = :rd",
                                      ExpressionAttributeValues={":rd": rd})

    return _resp(200, {"status": "EXECUTING", "action_id": action_id})


# ========== Status & Chat ==========

def _get_status():
    alarms = cw_client.describe_alarms(MaxRecords=100)
    alarm_list = [{"name": a["AlarmName"], "state": a["StateValue"], "reason": a.get("StateReason", "")}
                  for a in alarms.get("MetricAlarms", [])]
    ok = sum(1 for a in alarm_list if a["state"] == "OK")
    alarm_count = sum(1 for a in alarm_list if a["state"] == "ALARM")
    workloads = workloads_table.scan().get("Items", [])
    return _resp(200, {
        "alarms": alarm_list,
        "summary": {"ok": ok, "alarm": alarm_count, "total": len(alarm_list)},
        "workload_count": len(workloads),
        "ws_url": os.environ.get("WS_URL", ""),
    })


def _chat(event):
    body = json.loads(event.get("body", "{}"))
    msg = body.get("message", "")
    if not msg:
        return _resp(400, {"error": "message required"})
    if not AGENT_RUNTIME_ARN:
        return _resp(200, {"response": f"AgentCore not configured. You asked: {msg}"})
    
    logger.info(f"Chat request: {msg}")
    from botocore.config import Config
    client = boto3.client("bedrock-agentcore", config=Config(read_timeout=540))
    sid = body.get("session_id", "")
    if not sid or len(sid) < 33:
        sid = str(uuid.uuid4())
    
    try:
        resp = client.invoke_agent_runtime(
            agentRuntimeArn=AGENT_RUNTIME_ARN, runtimeSessionId=sid,
            payload=json.dumps({"prompt": msg, "agent": "chatbot", "session_id": sid}).encode(),
        )
        logger.info(f"AgentCore response keys: {resp.keys()}")
        
        # Parse response - AgentCore returns 'response' key with StreamingBody
        response_body = resp.get("response")
        if response_body:
            if hasattr(response_body, 'read'):
                text = response_body.read().decode("utf-8")
            else:
                text = str(response_body)
        else:
            # Fallback to 'payload' key
            payload = resp.get("payload")
            if payload:
                if isinstance(payload, bytes):
                    text = payload.decode("utf-8")
                else:
                    text = str(payload)
            else:
                text = ""
        
        logger.info(f"Parsed text length: {len(text)}")
        
        # AgentCore double-encodes: unwrap if needed
        try:
            unwrapped = json.loads(text)
            if isinstance(unwrapped, str):
                text = unwrapped
        except (json.JSONDecodeError, TypeError):
            pass
        
        return _resp(200, {"response": text, "session_id": sid})
    except Exception as e:
        logger.exception("Chat error")
        return _resp(500, {"error": str(e)})


# ========== Helpers ==========

def _dec(obj):
    if isinstance(obj, list): return [_dec(i) for i in obj]
    if isinstance(obj, dict): return {k: _dec(v) for k, v in obj.items()}
    if isinstance(obj, Decimal): return int(obj) if obj == int(obj) else float(obj)
    return obj


def _resp(code, body):
    return {
        "statusCode": code,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*",
                     "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type"},
        "body": json.dumps(body, default=str),
    }
