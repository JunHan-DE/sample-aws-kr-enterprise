---
name: aidlc-functional
description: AIDLC Functional Design — unit별 비즈니스 로직, 도메인 모델, 검증 규칙을 질문-응답으로 설계한다
argument-hint: [unit-name]
user-invocable: true
context: fork
agent: aidlc-analyst
---

# AIDLC Functional Design (Per Unit)

You are executing the **Functional Design** stage of AIDLC Construction for unit **$ARGUMENTS**.

This stage produces technology-agnostic business logic artifacts through deep Q&A with the team.

## Prerequisites

Before starting, verify:
1. Read `aidlc-docs/aidlc-state.md` — confirm this unit exists and execution-plan.md shows this stage as EXECUTE
2. If prerequisites are not met, stop and explain what is missing

## Procedure

### Step 1 — Load Unit Context

Read all relevant Inception artifacts:
- `aidlc-docs/inception/unit-of-work.md` — find the entry for unit **$ARGUMENTS**
- `aidlc-docs/inception/story-maps/` — load story maps related to this unit
- Any other Inception artifacts referenced by this unit

Summarize what you understand about this unit's scope, responsibilities, and boundaries.

### Step 2 — Create Design Plan

Create a checkbox plan covering all areas that need functional design decisions:
- [ ] Business logic flows
- [ ] Domain model and entities
- [ ] Validation rules and business constraints
- [ ] Data flow and integration points
- [ ] Error handling and edge cases
- [ ] Frontend components (if this is a UI unit)

Save the plan to:
`aidlc-docs/construction/plans/$ARGUMENTS-functional-design-plan.md`

### Step 3 — Generate Question File

Create the question file at:
`aidlc-docs/construction/$ARGUMENTS/functional-design-questions.md`

Organize questions into these categories. Ask for ALL ambiguous areas — over-asking beats under-asking.

```markdown
# Functional Design Questions: $ARGUMENTS

## Business Logic & Domain Model
- Q1: [question]
  [Answer]:
- Q2: [question]
  [Answer]:

## Business Rules & Validation
- Q1: [question]
  [Answer]:

## Data Flow & Integration Points
- Q1: [question]
  [Answer]:

## Error Handling & Edge Cases
- Q1: [question]
  [Answer]:

## Frontend Components (if applicable)
- Q1: [question]
  [Answer]:
```

Rules for question generation:
- Default to asking when there is ANY ambiguity
- Be specific — reference concrete entities, flows, and scenarios from the Inception artifacts
- Include "why" questions, not just "what" — understanding intent prevents design mistakes
- Each question should be independently answerable (no dependencies between questions)

Present the question file path to the team and explain what you need answered.

### Step 4 — GATE: Wait for Team Answers

Stop and wait. Tell the team:
> "질문 파일이 생성되었습니다: `aidlc-docs/construction/$ARGUMENTS/functional-design-questions.md`
> 각 질문의 `[Answer]:` 부분에 답변을 작성해 주세요. 완료되면 알려주세요."

Do NOT proceed until the team signals that answers are ready.

### Step 5 — Answer Analysis

When answers arrive:
1. Read the completed question file
2. Flag any vague answers: look for "depends", "maybe", "TBD", "not sure", empty answers
3. If vague answers exist, create a follow-up clarification file:
   `aidlc-docs/construction/$ARGUMENTS/functional-design-clarifications.md`
4. Present clarifications and wait again
5. Repeat until ALL answers are concrete and actionable

### Step 6 — Generate Design Artifacts

With all answers resolved, generate artifacts in:
`aidlc-docs/construction/$ARGUMENTS/functional-design/`

| File | Content |
|------|---------|
| `business-logic-model.md` | Business logic flows, process descriptions, decision trees |
| `business-rules.md` | Validation rules, business constraints, invariants |
| `domain-entities.md` | Domain model, entity relationships, data structures |
| `frontend-components.md` | UI component specifications (only for UI units) |

Each artifact must:
- Trace back to specific answers from the Q&A
- Be technology-agnostic (no specific frameworks, databases, or services)
- Be detailed enough for the next stage (NFR) to assess non-functional needs

### Step 7 — GATE: Approve & Continue

Present a summary of all generated artifacts with key decisions highlighted.

Ask the team:
> "Functional Design이 완료되었습니다. 검토 후 선택해 주세요:
> 1. **Approve & Continue** — NFR 단계로 진행
> 2. **Request Changes** — 수정 필요 사항을 알려주세요"

If approved, update `aidlc-state.md` to reflect functional design completion for this unit.
