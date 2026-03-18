---
name: aidlc-code
description: AIDLC Code Generation — 승인된 설계 계획에 따라 코드를 생성한다
argument-hint: [unit-name]
user-invocable: true
---

# AIDLC Code Generation (Per Unit)

You are executing the **Code Generation** stage of AIDLC Construction for unit **$ARGUMENTS**.

This skill does NOT run in a forked context. It delegates to the `aidlc-developer` agent which handles the actual code generation process.

## Prerequisites

Before starting, verify:
1. Read `aidlc-docs/aidlc-state.md` — confirm ALL design stages for unit **$ARGUMENTS** are approved:
   - Functional Design: approved
   - NFR Requirements + Design: approved (or explicitly skipped in execution plan)
   - Infrastructure Design: approved (or explicitly skipped in execution plan)
2. If any required design stage is incomplete, stop and explain which stage needs to be completed first

## Procedure

### Step 1 — Verify Readiness

Read `aidlc-docs/aidlc-state.md` and confirm design completion status for this unit.

List all design artifacts that will feed into code generation:
- `aidlc-docs/construction/$ARGUMENTS/functional-design/` — business logic, domain model, rules
- `aidlc-docs/construction/$ARGUMENTS/nfr-requirements/` — NFR targets, tech stack (if exists)
- `aidlc-docs/construction/$ARGUMENTS/nfr-design/` — design patterns (if exists)
- `aidlc-docs/construction/$ARGUMENTS/infrastructure-design/` — service mapping, deployment (if exists)

Present a summary of what will be built.

### Step 2 — Delegate to Developer Agent

Spawn the `aidlc-developer` agent with the following task:

> "Unit: $ARGUMENTS
>
> Load all design artifacts from aidlc-docs/construction/$ARGUMENTS/.
> Execute the full code generation process:
> 1. Analyze all design artifacts and create a detailed implementation plan
> 2. Present the plan to the team for approval before writing any code
> 3. Upon approval, generate code following the design specifications
> 4. Write tests as specified in the design artifacts
> 5. Update aidlc-state.md to reflect code generation progress
> 6. Log all actions to aidlc-docs/audit.md"

### Step 3 — Report Results

After the developer agent completes:
1. Summarize what was generated:
   - Files created/modified
   - Test coverage
   - Any deviations from the design (with justification)
2. Update `aidlc-state.md` to reflect code generation completion for this unit
3. Log to `aidlc-docs/audit.md`

### Step 4 — Suggest Quality Gate

After code generation is complete, suggest:
> "코드 생성이 완료되었습니다. Quality Gate를 실행하여 코드 리뷰와 테스트를 진행하세요:
> `/aidlc-gate $ARGUMENTS`"
