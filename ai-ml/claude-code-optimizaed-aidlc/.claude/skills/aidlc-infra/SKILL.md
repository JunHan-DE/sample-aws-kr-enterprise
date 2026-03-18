---
name: aidlc-infra
description: AIDLC Infrastructure Design — 논리 컴포넌트를 실제 인프라 서비스에 매핑한다
argument-hint: [unit-name]
user-invocable: true
context: fork
agent: aidlc-analyst
---

# AIDLC Infrastructure Design (Per Unit)

You are executing the **Infrastructure Design** stage of AIDLC Construction for unit **$ARGUMENTS**.

This stage maps the logical components from NFR Design to real infrastructure services and produces deployment architecture.

## Prerequisites

Before starting, verify:
1. Read `aidlc-docs/aidlc-state.md` — confirm functional design is complete for unit **$ARGUMENTS**
2. NFR design is recommended but not strictly required — if skipped, note that infrastructure choices are based solely on functional design
3. If functional design is not complete, stop: "Functional Design must be completed first. Run `/aidlc-functional $ARGUMENTS`."

## Procedure

### Step 1 — Load Design Artifacts

Read all preceding design artifacts for this unit:
- `aidlc-docs/construction/$ARGUMENTS/functional-design/` — business logic, domain model, rules
- `aidlc-docs/construction/$ARGUMENTS/nfr-requirements/` — NFR targets, tech stack decisions (if exists)
- `aidlc-docs/construction/$ARGUMENTS/nfr-design/` — patterns, logical components (if exists)

Summarize the key infrastructure-relevant decisions:
- What logical components need physical mapping?
- What are the performance/scalability/availability targets?
- What tech stack decisions constrain infrastructure choices?

### Step 2 — Create Infrastructure Design Plan

Create a checkbox plan covering infrastructure design areas relevant to THIS unit.

Save to: `aidlc-docs/construction/plans/$ARGUMENTS-infrastructure-design-plan.md`

### Step 3 — Generate Question File

Create the question file at:
`aidlc-docs/construction/$ARGUMENTS/infrastructure-design-questions.md`

Only include categories relevant to this unit. These are inspirational — adapt to what the unit actually needs:

```markdown
# Infrastructure Design Questions: $ARGUMENTS

## Compute
<!-- Lambda, ECS, EKS, EC2, App Runner, Fargate... -->
- Q1: [question]
  [Answer]:

## Storage & Database
<!-- S3, DynamoDB, RDS, Aurora, ElastiCache, EFS... -->
- Q1: [question]
  [Answer]:

## Networking & API
<!-- VPC, API Gateway, ALB/NLB, CloudFront, Route 53... -->
- Q1: [question]
  [Answer]:

## Messaging & Integration
<!-- SQS, SNS, EventBridge, Step Functions, Kinesis... -->
- Q1: [question]
  [Answer]:

## Monitoring & Observability
<!-- CloudWatch, X-Ray, OpenTelemetry, dashboards, alarms... -->
- Q1: [question]
  [Answer]:

## Cost Considerations
<!-- Reserved capacity, savings plans, cost allocation, budget limits... -->
- Q1: [question]
  [Answer]:

## Existing Infrastructure
<!-- Shared resources, cross-unit dependencies, VPC peering... -->
- Q1: [question]
  [Answer]:
```

Rules for question generation:
- Reference specific logical components from NFR Design and ask which physical service to map them to
- Include cost vs. performance trade-off questions
- Ask about existing infrastructure that can be reused
- Ask about deployment preferences (IaC tool, CI/CD pipeline, environments)
- Be specific about AWS services — name concrete options, do not ask open-ended "what service?"

Present the question file path and explain what you need.

### Step 4 — GATE: Wait for Answers

> "Infrastructure Design 질문 파일이 생성되었습니다: `aidlc-docs/construction/$ARGUMENTS/infrastructure-design-questions.md`
> 각 질문의 `[Answer]:` 부분에 답변을 작성해 주세요. 완료되면 알려주세요."

Do NOT proceed until answers are ready.

### Step 5 — Answer Analysis & Clarification

1. Read completed answers
2. Flag vague, incomplete, or contradictory answers
3. Check for consistency with NFR requirements (e.g., "chose single-AZ but NFR requires 99.9% uptime")
4. If issues exist, create: `aidlc-docs/construction/$ARGUMENTS/infrastructure-design-clarifications.md`
5. Wait for resolution, repeat until all answers are concrete

### Step 6 — Generate Infrastructure Design Artifacts

Generate in `aidlc-docs/construction/$ARGUMENTS/infrastructure-design/`:

| File | Content |
|------|---------|
| `infrastructure-design.md` | Physical service mapping (logical component -> AWS service), configuration details, sizing, service interactions |
| `deployment-architecture.md` | Deployment topology, environments (dev/staging/prod), IaC approach, CI/CD pipeline design, rollback strategy |
| `shared-infrastructure.md` | Only if this unit uses or creates shared resources — VPC, shared databases, common APIs, cross-unit dependencies |

Each artifact must:
- Map every logical component to a specific AWS service with rationale
- Include configuration details (instance types, capacity units, retention periods, etc.)
- Document cost implications and optimization opportunities
- Reference NFR requirements to justify infrastructure choices
- Identify shared vs. unit-specific resources clearly

### Step 7 — GATE: Approve & Continue

Present a summary with an architecture overview highlighting:
- Key service choices and their rationale
- Cost estimate summary (if available)
- Deployment strategy
- Any risks or trade-offs

Ask the team:
> "Infrastructure Design이 완료되었습니다. 검토 후 선택해 주세요:
> 1. **Request Changes** — 수정 필요 사항을 알려주세요
> 2. **Approve & Continue to Code Generation** — 코드 생성 단계로 진행"

If approved, update `aidlc-state.md` to reflect infrastructure design completion for this unit.
