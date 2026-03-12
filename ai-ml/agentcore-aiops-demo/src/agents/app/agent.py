"""AIOps AgentCore Entrypoint - routes to RCA Graph or Chatbot agent."""
import json
import os
import re

from strands import Agent, tool
from strands.models.bedrock import BedrockModel
from strands.multiagent import GraphBuilder
from bedrock_agentcore.runtime import BedrockAgentCoreApp

from tools import (logs_agent, metrics_agent, infrastructure_agent, knowledge_agent,
                    remediation_agent, query_reports, query_alarms)

MODEL_ID = os.environ.get("MODEL_ID", "apac.anthropic.claude-sonnet-4-20250514-v1:0")
REGION = os.environ.get("AWS_REGION", "ap-northeast-2")

model = BedrockModel(model_id=MODEL_ID, region_name=REGION)

# ========================================================================
# RCA Graph: Collector → Writer → Reviewer → (loop back or finish)
# ========================================================================

MAX_ITERATIONS = 3

# --- Collector Agent prompt ---
COLLECTOR_PROMPT = """You are an SRE Information Collector. Your job is to gather data about an incident, focusing on the CAUSAL CHAIN from the alarm back to its root cause.

Investigation strategy:
1. Start from the alarm — what metric breached? what resource is affected?
2. Check the CURRENT STATE of the affected resource — is it actually broken right now?
3. Search CloudTrail for RECENT CHANGES to that specific resource — who changed what, when?
4. Follow the causal chain: if resource A is broken because of resource B, investigate B
5. Stop investigating when you find the specific change that caused the alarm

Use your tools:
- logs_agent: CloudWatch Logs errors + CloudTrail API changes + EC2 system logs + AWS Config history
- metrics_agent: CloudWatch Metrics — focus on the alarming metric and directly related metrics
- infrastructure_agent: Current state of affected resources (is it actually broken?)
- knowledge_agent: Runbooks for this type of incident

IMPORTANT:
- Clearly distinguish between "currently broken" vs "working correctly"
- For each resource you investigate, state whether it is HEALTHY or UNHEALTHY with evidence
- Report the EXACT change that caused the issue (e.g. "outbound rule changed from X to Y")
- Do NOT report pre-existing conditions unless they are part of the causal chain for THIS alarm

TEMPORAL CAUSATION — CRITICAL:
- A change can only be the root cause if it happened BEFORE the alarm AND the effect is STILL PRESENT
- If a change was already REVERTED before the alarm fired, it is NOT the root cause — look for other causes
- When you find a CloudTrail change, ALWAYS check: (a) when did it happen relative to the alarm? (b) was it reverted? (c) is the resource CURRENTLY in the changed state?
- Do NOT attribute the alarm to a past change that has already been undone

TECHNICAL CONSISTENCY — CRITICAL:
- Verify that the suspected cause can TECHNICALLY produce the observed symptom
  - Example: Egress rule blocked → expect 5xx (502/503), NOT 4xx. If alarm is 4xx, Egress block is NOT the cause
  - Example: Instance stopped → expect unhealthy target, NOT high CPU
- If the suspected cause does not match the alarm type, DISCARD it and investigate other possibilities"""

# --- Writer Agent prompt ---
WRITER_PROMPT = """You are an RCA Report Writer. Write the report in Korean (한국어).
Keep technical terms, product names, and service names in English (e.g. CloudWatch, Security Group, ALB, EC2, RDS).

Return ONLY valid JSON (no markdown, no explanation):
{
  "summary": "1-2 sentence root cause summary",
  "timeline": [{"time": "ISO8601", "event": "description"}],
  "root_cause": {"description": "...", "evidence": ["..."], "confidence": "HIGH|MEDIUM|LOW"},
  "impact": {"affected_resources": ["..."], "service_impact": "..."},
  "recommended_actions": [
    {
      "action_id": "1",
      "priority": 1,
      "description": "Human-readable description of the action",
      "command": "aws cli WRITE command with real resource IDs",
      "code": "boto3 Python WRITE code with real resource IDs",
      "risk_level": "LOW|MEDIUM|HIGH",
      "status": "PENDING_APPROVAL"
    }
  ]
}

CRITICAL rules for the report:
- EVERY CLAIM MUST BE BACKED BY EVIDENCE from the collected data. Never assume, guess, or skip steps.
- Trace the causal chain ONE STEP AT A TIME: A caused B, B caused C. Each step must have evidence.
  - BAD: "SG outbound changed → RDS connection failed" (skipped the ALB→EC2 step)
  - GOOD: "ALB SG outbound changed → ALB cannot send responses to EC2 → health check timeout → UNHEALTHY"
- Clearly identify WHICH resource owns the changed configuration (e.g. "ALB Security Group" not just "Security Group")
- Do NOT infer effects beyond what the evidence shows. If you only see Target.Timeout, say that — do not assume DB connectivity issues unless there is separate evidence for it.
- TEMPORAL VALIDATION: If a change was reverted BEFORE the alarm, it cannot be the root cause. State this explicitly and look for other causes.
- TECHNICAL CONSISTENCY: Verify the suspected cause matches the alarm type:
  - Network/connectivity block → 5xx errors (502/503), NOT 4xx
  - Application misconfiguration → 4xx errors
  - Resource down → unhealthy targets, NOT metric threshold breach
  If the cause does not technically produce the observed alarm, set confidence to LOW and note the inconsistency.

CRITICAL rules for recommended_actions:
- MINIMUM NECESSARY ACTIONS ONLY: Only include actions that directly fix the root cause of THIS alarm
- DO NOT fix pre-existing issues unrelated to this alarm's root cause
- DO NOT add preventive measures, monitoring improvements, or optimizations
- DO NOT modify resources that are already working correctly
- Each action must have a clear causal link: "this specific change caused the alarm, so reverting/fixing it resolves the alarm"
- command and code MUST use supported remediation operations
- All values must come from the collected investigation data — NEVER use placeholder or dummy values
- If a command requires an identifier (rule ID, resource ARN, etc.), it must be present in the collected data
- Use real resource IDs from the investigation
- If the root cause is a configuration change, the action should REVERSE that specific change
- Verify from collected evidence that the resource/setting is actually broken BEFORE recommending a fix"""

# --- Reviewer Agent prompt ---
REVIEWER_PROMPT = """You are an RCA Report Quality Reviewer. Evaluate the RCA report against these criteria:

1. ROOT CAUSE: Is it specific, evidence-backed, and directly explains why THIS alarm fired?
2. EVIDENCE: Are there concrete log entries, metric values, or resource states cited?
3. CAUSAL CHAIN ACCURACY:
   - Does each step in the causal chain have evidence? (A→B must have proof that A caused B)
   - FAIL if any step is assumed/guessed without evidence
   - FAIL if the chain skips steps (e.g. "SG changed → DB failed" without explaining the intermediate steps)
   - FAIL if the report attributes an effect to the wrong resource (e.g. saying "EC2 SG" when it was "ALB SG")
4. TEMPORAL VALIDITY:
   - FAIL if the root cause is a change that was REVERTED before the alarm fired
   - FAIL if the root cause happened long before the alarm with no explanation of delayed effect
   - The root cause must be ACTIVE (still present) at the time the alarm triggered
5. TECHNICAL CONSISTENCY:
   - FAIL if the suspected cause cannot technically produce the observed alarm type
   - Network/connectivity block → should cause 5xx, NOT 4xx
   - Application error → should cause 4xx, NOT 5xx
   - Resource down → should cause unhealthy targets, NOT metric threshold
   - If the cause-effect relationship is technically impossible, FAIL regardless of other evidence
6. ACTIONS - NECESSITY: Does EVERY recommended action have a direct causal link to the alarm?
   - FAIL if any action fixes something that is NOT broken (verify against collected evidence)
   - FAIL if any action addresses a pre-existing issue unrelated to this alarm
   - FAIL if any action is preventive/optimization rather than remediation
7. ACTIONS - CORRECTNESS: Do the commands actually reverse/fix the identified root cause?

Respond in this EXACT format:
VERDICT: PASS or FAIL
GAPS: (only if FAIL) Bullet list of specific issues
SCORE: 1-10

Be strict about temporal validity and technical consistency. A plausible-sounding cause that is technically impossible must FAIL."""


def needs_revision(state):
    """Check if reviewer says FAIL - loop back to collector."""
    review_result = state.results.get("reviewer")
    if not review_result:
        return False
    text = str(review_result.result).upper()
    return "VERDICT: FAIL" in text or "VERDICT:FAIL" in text


def is_approved(state):
    """Check if reviewer says PASS - proceed to finish."""
    review_result = state.results.get("reviewer")
    if not review_result:
        return True  # default to approved if no result
    text = str(review_result.result).upper()
    return "VERDICT: PASS" in text or "VERDICT:PASS" in text


def build_rca_graph():
    """Build a fresh RCA graph with new Agent instances per invocation."""
    col = Agent(name="collector", model=model, system_prompt=COLLECTOR_PROMPT,
                tools=[logs_agent, metrics_agent, infrastructure_agent, knowledge_agent], callback_handler=None)
    wri = Agent(name="writer", model=model, system_prompt=WRITER_PROMPT, tools=[], callback_handler=None)
    rev = Agent(name="reviewer", model=model, system_prompt=REVIEWER_PROMPT, tools=[], callback_handler=None)

    builder = GraphBuilder()
    builder.add_node(col, "collector")
    builder.add_node(wri, "writer")
    builder.add_node(rev, "reviewer")

    builder.add_edge("collector", "writer")
    builder.add_edge("writer", "reviewer")
    builder.add_edge("reviewer", "collector", condition=needs_revision)

    builder.set_max_node_executions(MAX_ITERATIONS * 3)
    builder.set_execution_timeout(600)
    builder.reset_on_revisit(True)
    builder.set_entry_point("collector")
    return builder.build()


def run_rca(prompt: str) -> str:
    """Execute the RCA graph and extract the final report."""
    graph = build_rca_graph()
    result = graph(prompt)

    # Graph failed (e.g. timeout) — raise so _rca_background handles it as FAILED
    if hasattr(result, 'status') and 'FAILED' in str(result.status).upper():
        raise RuntimeError(f"RCA Graph failed: {result.status}")

    # Extract the writer's output (JSON report) from the last execution
    writer_result = result.results.get("writer")
    if writer_result:
        text = str(writer_result.result)
    else:
        text = str(result)

    # Extract JSON from markdown if present
    if "```json" in text:
        match = re.search(r'```json\s*(\{.*?\})\s*```', text, re.DOTALL)
        if match:
            text = match.group(1)
    elif "```" in text:
        match = re.search(r'```\s*(\{.*?\})\s*```', text, re.DOTALL)
        if match:
            text = match.group(1)

    return text


# ========================================================================
# RCA as Tool (for Chatbot to invoke)
# ========================================================================

@tool
def rca_agent(query: str) -> str:
    """Generate a structured RCA report for an incident using the multi-agent RCA graph.
    The graph collects information, writes a report, and reviews quality with feedback loops.

    Args:
        query: Incident description including alarm name, time, and context
    """
    try:
        return run_rca(query)
    except Exception as e:
        return f"RCA agent error: {e}"


# ========================================================================
# Chatbot Agent
# ========================================================================

CHATBOT_PROMPT = """You are a friendly AIOps assistant chatbot. Answer in natural Korean (한국어).

Available Tools:
- logs_agent: CloudWatch Logs + CloudTrail 분석
- metrics_agent: CloudWatch Metrics 분석
- infrastructure_agent: AWS 리소스 상태 조사
- knowledge_agent: 런북/운영 이력 검색
- rca_agent: RCA 리포트 생성 (멀티에이전트 그래프로 정보수집→리포트작성→품질검증 수행)
- query_reports: DynamoDB에서 RCA 리포트 이력 조회 (날짜, 알람 이름으로 검색)
- query_alarms: CloudWatch 알람 목록 및 이력 조회

Guidelines:
- 사용자가 RCA를 요청하면 rca_agent tool을 사용하고, 결과를 자연어로 설명
- 사용자가 과거 알람/리포트를 물으면 query_reports 또는 query_alarms 사용
- 기술적 내용도 이해하기 쉽게 설명
- 필요하면 specialist agents를 직접 호출하여 실시간 정보 제공

CRITICAL — Accuracy over speed:
- RCA 리포트 내용을 전달할 때, 기술적으로 맞는지 반드시 검증하라
  - 예: "보안그룹 Egress 차단이 4xx 원인" → Egress 차단은 5xx를 유발하지 4xx가 아님 → 리포트 오류 가능성 언급
- 이미 복구된 변경사항을 현재 장애의 원인으로 제시하지 마라
- 확실하지 않으면 "확인이 필요합니다"라고 솔직하게 답하라. 추측으로 확신 있는 답변을 만들지 마라
- 사용자가 리포트 내용에 의문을 제기하면, 리포트를 방어하지 말고 직접 조사하여 사실 확인하라"""

chatbot_agent = Agent(
    model=model,
    system_prompt=CHATBOT_PROMPT,
    tools=[logs_agent, metrics_agent, infrastructure_agent, knowledge_agent,
           rca_agent, query_reports, query_alarms],
    callback_handler=None,
)


# ========================================================================
# Entrypoint
# ========================================================================

EXECUTOR_PROMPT = """You are an Executor Agent. You receive a specific approved remediation action and execute it safely.

You will receive:
- action description
- command (AWS CLI)
- code (boto3 Python)

Execution steps:
1. Use infrastructure_agent to check the CURRENT STATE of the affected resource
2. DRY-RUN FIRST: Execute the command with dry-run validation
   - For remediation_agent tools, verify the parameters match the current resource state
   - Example: before revoking a rule, confirm that exact rule (protocol, port, CIDR/SG) actually exists
   - Example: before authorizing a rule, confirm it doesn't already exist
3. If dry-run/validation fails, you MAY adjust ONLY technical parameters to fix the command:
   - ALLOWED to change: protocol (-1 vs tcp), port range (0 vs 80), CIDR format
   - NEVER change: resource IDs (instance ID, security group ID, target group ARN, etc.)
   - NEVER change: the intent of the action (e.g. don't switch authorize to revoke)
4. Execute the corrected command via remediation_agent
5. Use infrastructure_agent to verify the fix was applied (before/after comparison)

Return the execution result as JSON:
{"action_id": "...", "status": "COMPLETED" or "FAILED", "result": "what was done", "before": "state before", "after": "state after", "adjustments": "any parameter adjustments made and why"}

CRITICAL SAFETY RULES:
- NEVER modify resource identifiers (IDs, ARNs, names)
- NEVER change the action's intent or target
- If you cannot execute safely, return FAILED with explanation"""

# ========================================================================
# Memory Helper
# ========================================================================

MEMORY_ID = os.environ.get("MEMORY_ID", "")

def _get_memory_context(session_id: str) -> str:
    """Retrieve short-term + long-term memory for chatbot context."""
    if not MEMORY_ID:
        return ""
    import boto3
    try:
        client = boto3.client("bedrock-agentcore", region_name=REGION)
        context_parts = []

        # Short-term: recent conversation turns
        try:
            resp = client.list_events(memoryId=MEMORY_ID, sessionId=session_id, actorId="user", maxResults=10)
            events = resp.get("events", [])
            if events:
                turns = []
                for e in events[-6:]:  # last 6 turns
                    for msg in e.get("payload", {}).get("conversationalMessages", []):
                        role = msg.get("role", "")
                        text = msg.get("content", "")
                        turns.append(f"{role}: {text}")
                if turns:
                    context_parts.append("=== Recent Conversation ===\n" + "\n".join(turns))
        except Exception:
            pass

        # Long-term: semantic memory records
        try:
            resp = client.retrieve_memory_records(
                memoryId=MEMORY_ID, namespacePrefix="/",
                query={"text": "user preferences and past interactions"},
                maxResults=5)
            records = resp.get("memoryRecords", [])
            if records:
                facts = [r.get("content", {}).get("text", "") for r in records if r.get("content", {}).get("text")]
                if facts:
                    context_parts.append("=== Long-term Memory ===\n" + "\n".join(facts[:5]))
        except Exception:
            pass

        return "\n\n".join(context_parts)
    except Exception:
        return ""


def _save_to_memory(session_id: str, user_msg: str, assistant_msg: str):
    """Save conversation turn to short-term memory (long-term extracted automatically)."""
    if not MEMORY_ID:
        return
    import boto3
    try:
        client = boto3.client("bedrock-agentcore", region_name=REGION)

        # Ensure session exists
        try:
            client.create_session(memoryId=MEMORY_ID, sessionId=session_id, actorId="user")
        except Exception:
            pass  # session may already exist

        # Write conversation turn
        client.create_event(
            memoryId=MEMORY_ID, sessionId=session_id, actorId="user",
            payload={"conversationalMessages": [
                {"role": "user", "content": user_msg},
                {"role": "assistant", "content": assistant_msg[:2000]},
            ]})
    except Exception:
        pass  # non-critical, don't fail the response


app = BedrockAgentCoreApp()


def _rca_background(task_id, prompt, payload):
    """Background thread: run RCA Graph, update DDB, send notifications."""
    import boto3
    from urllib.request import Request, urlopen
    report_id = payload.get("report_id", "")
    workload_name = payload.get("workload_name", "")
    alarm_data = payload.get("alarm", {})
    notification = payload.get("notification", {})
    created_at = payload.get("created_at", "")

    ddb = boto3.resource("dynamodb", region_name=REGION)
    reports_table = ddb.Table(os.environ.get("REPORTS_TABLE", "aiops-demo-reports"))

    try:
        rca_result = run_rca(prompt)

        # Parse JSON from RCA result
        parsed = rca_result
        for _ in range(3):
            if isinstance(parsed, str):
                if "```json" in parsed:
                    match = re.search(r'```json\s*(\{.*?\})\s*```', parsed, re.DOTALL)
                    if match:
                        parsed = match.group(1)
                try:
                    parsed = json.loads(parsed)
                except (json.JSONDecodeError, TypeError):
                    break
            else:
                break

        if not isinstance(parsed, dict):
            parsed = {"summary": str(parsed)[:500], "timeline": [], "root_cause": {"description": str(parsed)[:500], "evidence": [], "confidence": "LOW"}, "impact": {}, "recommended_actions": []}

        report_data = {
            "report_id": report_id, "created_at": created_at, "workload": workload_name,
            "alarm": alarm_data, **parsed, "status": "PENDING",
        }
        status = "PENDING"
    except Exception as e:
        report_data = {
            "report_id": report_id, "created_at": created_at, "workload": workload_name,
            "alarm": alarm_data, "summary": f"분석 오류: {e}", "timeline": [],
            "root_cause": {"description": str(e), "evidence": [], "confidence": "LOW"},
            "impact": {}, "recommended_actions": [], "status": "FAILED",
        }
        status = "FAILED"

    # Update DDB
    try:
        reports_table.update_item(
            Key={"report_id": report_id},
            UpdateExpression="SET report_data = :rd, #s = :s",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":rd": report_data, ":s": status},
        )
    except Exception:
        pass

    # Send notifications
    try:
        alarm_name = alarm_data.get("name", "")
        msg = f"AIOps Alert — {alarm_name}\n\n{report_data.get('summary', '')}\n\n📋 리포트 보기: {os.environ.get('WEB_URL', '')}/reports/{report_id}"
        slack_url = notification.get("slack_webhook", "")
        if slack_url:
            urlopen(Request(slack_url, data=json.dumps({"text": msg}).encode(), headers={"Content-Type": "application/json"}), timeout=5)
    except Exception:
        pass

    app.complete_async_task(task_id)


def _executor_background(task_id, prompt, payload):
    """Background thread: execute approved action, update DDB."""
    import boto3
    report_id = payload.get("report_id", "")
    action_id = payload.get("action_id", "")

    ddb = boto3.resource("dynamodb", region_name=REGION)
    reports_table = ddb.Table(os.environ.get("REPORTS_TABLE", "aiops-demo-reports"))

    try:
        executor = Agent(model=model, system_prompt=EXECUTOR_PROMPT,
                         tools=[remediation_agent, infrastructure_agent], callback_handler=None)
        result_text = str(executor(prompt))
        # Check if agent reported failure in its response
        if "FAILED" in result_text.upper() and "COMPLETED" not in result_text.upper():
            exec_status = "FAILED"
        else:
            exec_status = "COMPLETED"
    except Exception as e:
        result_text = f"실행 오류: {e}"
        exec_status = "FAILED"

    # Update DDB
    try:
        item = reports_table.get_item(Key={"report_id": report_id}).get("Item", {})
        rd = item.get("report_data", {})
        for a in rd.get("recommended_actions", []):
            if a.get("action_id") == action_id:
                a["status"] = exec_status
                a["execution_result"] = result_text[:2000]
                break
        all_done = all(a.get("status") in ("COMPLETED", "FAILED", "PENDING_APPROVAL") for a in rd.get("recommended_actions", []))
        report_status = "RESOLVED" if all_done and any(a.get("status") == "COMPLETED" for a in rd.get("recommended_actions", [])) else item.get("status", "APPROVED")
        reports_table.update_item(
            Key={"report_id": report_id},
            UpdateExpression="SET report_data = :rd, #s = :s",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":rd": rd, ":s": report_status},
        )
    except Exception:
        pass

    app.complete_async_task(task_id)


@app.entrypoint
def invoke(payload):
    prompt = payload.get("prompt", "")
    agent_name = payload.get("agent", "chatbot")
    session_id = payload.get("session_id", "")

    if not prompt:
        return json.dumps({"error": "No prompt provided"})

    if agent_name == "rca":
        # Async: start background task, return immediately
        import threading
        task_id = app.add_async_task("rca_analysis")
        payload["created_at"] = payload.get("created_at", "")
        t = threading.Thread(target=_rca_background, args=(task_id, prompt, payload), daemon=True)
        t.start()
        return json.dumps({"status": "ANALYZING", "report_id": payload.get("report_id", ""), "task_id": task_id})
    elif agent_name == "executor":
        import threading
        task_id = app.add_async_task("executor")
        t = threading.Thread(target=_executor_background, args=(task_id, prompt, payload), daemon=True)
        t.start()
        return json.dumps({"status": "EXECUTING", "report_id": payload.get("report_id", ""), "task_id": task_id})
    else:
        # Chatbot with memory
        memory_ctx = _get_memory_context(session_id) if session_id else ""
        if memory_ctx:
            full_prompt = f"{memory_ctx}\n\n=== Current Question ===\n{prompt}"
        else:
            full_prompt = prompt

        response = chatbot_agent(full_prompt)
        result = str(response)

        # Save to memory (async-safe, non-blocking)
        if session_id:
            _save_to_memory(session_id, prompt, result)

        return result


if __name__ == "__main__":
    app.run()
