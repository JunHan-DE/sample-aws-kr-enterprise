---
name: aidlc-nfr
description: AIDLC NFR Requirements & Design — unit별 비기능 요구사항과 기술스택을 결정하고 패턴을 설계한다
argument-hint: [unit-name]
user-invocable: true
context: fork
agent: aidlc-analyst
---

# AIDLC NFR Requirements + NFR Design (Per Unit)

You are executing the **NFR Requirements** and **NFR Design** stages of AIDLC Construction for unit **$ARGUMENTS**.

This skill combines two stages that form a natural pair: first establish non-functional requirements and tech stack, then design patterns to meet those requirements.

## Prerequisites

Before starting, verify:
1. Read `aidlc-docs/aidlc-state.md` — confirm functional design is complete and approved for unit **$ARGUMENTS**
2. If not, stop and explain: "Functional Design must be completed first. Run `/aidlc-functional $ARGUMENTS`."

---

## PART 1: NFR Requirements

### Step 1 — Load Functional Design

Read all artifacts from:
`aidlc-docs/construction/$ARGUMENTS/functional-design/`

Summarize the functional scope that will drive NFR considerations.

### Step 2 — Generate NFR Question File

Create the question file at:
`aidlc-docs/construction/$ARGUMENTS/nfr-questions.md`

Cover all 8 categories. When in doubt, ask — overconfidence leads to poor system quality.

```markdown
# NFR Questions: $ARGUMENTS

## Scalability
<!-- Load patterns, growth projections, capacity planning -->
- Q1: [question]
  [Answer]:

## Performance
<!-- Response time targets, throughput requirements, latency budgets -->
- Q1: [question]
  [Answer]:

## Availability
<!-- Uptime targets, DR requirements, failover expectations -->
- Q1: [question]
  [Answer]:

## Security
<!-- Compliance requirements, auth model, threat considerations -->
- Q1: [question]
  [Answer]:

## Tech Stack
<!-- Technology preferences, constraints, integration requirements -->
- Q1: [question]
  [Answer]:

## Reliability
<!-- Fault tolerance, monitoring needs, alerting requirements -->
- Q1: [question]
  [Answer]:

## Maintainability
<!-- Testing strategy, documentation needs, operational requirements -->
- Q1: [question]
  [Answer]:

## Usability
<!-- UX requirements, accessibility standards -->
- Q1: [question]
  [Answer]:
```

Rules for question generation:
- Ground every question in the functional design — reference specific business logic flows or domain entities
- Ask about concrete thresholds (e.g., "What is the acceptable p99 latency for X?") not vague preferences
- Include trade-off questions where relevant ("Would you prioritize consistency over availability for X?")
- Only ask categories relevant to this unit (skip Usability for backend-only units, etc.)

Present the question file path and explain what you need.

### Step 3 — GATE: Wait for Answers

> "NFR 질문 파일이 생성되었습니다: `aidlc-docs/construction/$ARGUMENTS/nfr-questions.md`
> 각 질문의 `[Answer]:` 부분에 답변을 작성해 주세요. 완료되면 알려주세요."

Do NOT proceed until answers are ready.

### Step 4 — Answer Analysis & Clarification

1. Read completed answers
2. Flag vague, incomplete, or contradictory answers
3. If issues exist, create: `aidlc-docs/construction/$ARGUMENTS/nfr-clarifications.md`
4. Wait for resolution, repeat until all answers are concrete

### Step 5 — Generate NFR Requirements Artifacts

Generate in `aidlc-docs/construction/$ARGUMENTS/nfr-requirements/`:

| File | Content |
|------|---------|
| `nfr-requirements.md` | All non-functional requirements organized by category, with measurable targets |
| `tech-stack-decisions.md` | Chosen technologies with rationale, version constraints, integration notes |

### Step 6 — GATE: Approve NFR Requirements

> "NFR Requirements가 완료되었습니다. 검토 후 선택해 주세요:
> 1. **Approve & Continue to NFR Design** — 패턴 설계로 진행
> 2. **Request Changes** — 수정 필요 사항을 알려주세요"

Do NOT proceed to Part 2 until approved.

---

## PART 2: NFR Design

### Step 6 — Load NFR Requirements

Read the NFR requirements just generated from:
`aidlc-docs/construction/$ARGUMENTS/nfr-requirements/`

### Step 7 — Generate NFR Design Question File

Create the question file at:
`aidlc-docs/construction/$ARGUMENTS/nfr-design-questions.md`

Focus on patterns and logical components needed to meet the NFR requirements:

```markdown
# NFR Design Questions: $ARGUMENTS

## Resilience Patterns
<!-- Circuit breakers, retries, bulkheads, graceful degradation -->
- Q1: [question]
  [Answer]:

## Scalability Patterns
<!-- Horizontal/vertical scaling, sharding, partitioning -->
- Q1: [question]
  [Answer]:

## Performance Patterns
<!-- Caching strategies, connection pooling, async processing -->
- Q1: [question]
  [Answer]:

## Security Patterns
<!-- Auth flows, encryption, secrets management, network isolation -->
- Q1: [question]
  [Answer]:

## Logical Infrastructure Components
<!-- Queues, caches, CDN, load balancers, service mesh -->
- Q1: [question]
  [Answer]:
```

Rules:
- Reference specific NFR requirements by ID when asking about pattern choices
- Ask about trade-offs between competing patterns
- Include questions about component boundaries and communication patterns

### Step 8 — GATE: Wait for Answers

> "NFR Design 질문 파일이 생성되었습니다: `aidlc-docs/construction/$ARGUMENTS/nfr-design-questions.md`
> 각 질문의 `[Answer]:` 부분에 답변을 작성해 주세요. 완료되면 알려주세요."

Wait for answers. Analyze, clarify, repeat until resolved.

### Step 9 — Generate NFR Design Artifacts

Generate in `aidlc-docs/construction/$ARGUMENTS/nfr-design/`:

| File | Content |
|------|---------|
| `nfr-design-patterns.md` | Selected patterns per category, how they address specific NFR requirements, interaction between patterns |
| `logical-components.md` | Logical infrastructure components (queues, caches, etc.), their purpose, sizing considerations, and relationships |

Each artifact must:
- Map every pattern/component back to a specific NFR requirement
- Remain at the logical level (e.g., "message queue" not "Amazon SQS") — physical mapping happens in Infrastructure Design
- Document trade-offs considered and why the chosen pattern was selected

### Step 10 — GATE: Approve & Continue

> "NFR Design이 완료되었습니다. 검토 후 선택해 주세요:
> 1. **Approve & Continue** — Infrastructure Design 단계로 진행
> 2. **Request Changes** — 수정 필요 사항을 알려주세요"

If approved, update `aidlc-state.md` to reflect NFR Requirements and NFR Design completion for this unit.
