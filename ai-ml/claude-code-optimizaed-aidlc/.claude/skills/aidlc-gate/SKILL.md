---
name: aidlc-gate
description: AIDLC Quality Gate — 코드 리뷰(GO/NO-GO)와 빌드/테스트(PASS/FAIL) 파이프라인을 실행한다
argument-hint: [unit-name]
user-invocable: true
---

# AIDLC Quality Gate Pipeline

You are executing the **Quality Gate** for unit **$ARGUMENTS**.

The Quality Gate is a two-phase pipeline: Code Review (GO/NO-GO) followed by Build & Test (PASS/FAIL). Phase 2 only runs if Phase 1 passes.

## Prerequisites

Before starting, verify:
1. Read `aidlc-docs/aidlc-state.md` — confirm code generation is complete for unit **$ARGUMENTS**
2. If code generation is not complete, stop: "Code Generation이 먼저 완료되어야 합니다. `/aidlc-code $ARGUMENTS`를 실행하세요."

## Procedure

### Phase 1 — Code Review

Spawn the `aidlc-reviewer` agent in review mode with the following task:

> "Perform a code review for unit $ARGUMENTS.
>
> Review scope:
> 1. Load design artifacts from aidlc-docs/construction/$ARGUMENTS/ — verify code implements the approved design
> 2. Check code quality: naming, structure, separation of concerns, error handling
> 3. Check test quality: coverage, edge cases, meaningful assertions
> 4. Check security: no hardcoded secrets, input validation, auth checks
> 5. Check for design deviations — any code that does not match the approved design must be flagged
>
> Produce a review report with verdict: GO or NO-GO.
> If NO-GO, list every required change with file path, line reference, and specific fix needed."

**After review completes:**

Report the result to the team:
- If **GO**: proceed to Phase 2
- If **NO-GO**:
  1. Present all required changes
  2. Suggest: "리뷰에서 수정이 필요한 항목이 발견되었습니다. 수정 후 다시 `/aidlc-gate $ARGUMENTS`를 실행하세요."
  3. Stop — do NOT proceed to Phase 2

### Phase 2 — Build & Test (Only If Phase 1 = GO)

Spawn the `aidlc-reviewer` agent in test mode with the following task:

> "Build and test unit $ARGUMENTS.
>
> Steps:
> 1. Build the project — verify compilation/transpilation succeeds
> 2. Run unit tests for this unit
> 3. Run integration tests if applicable
> 4. Run any additional tests defined in the design artifacts
> 5. Collect coverage metrics
>
> Produce a test report with verdict: PASS or FAIL.
> If FAIL, list every failure with test name, expected vs actual, and stack trace."

**After testing completes:**

Report the result to the team:
- If **FAIL**:
  1. Present all failures
  2. Suggest: "테스트 실패 항목이 있습니다. 수정 후 다시 `/aidlc-gate $ARGUMENTS`를 실행하세요."
  3. Stop

### Phase 3 — Gate Passed (Both Phases Successful)

If both Code Review = GO and Build & Test = PASS:

1. Update `aidlc-state.md`:
   - Mark unit **$ARGUMENTS** as verified
   - Record code review result: GO
   - Record build & test result: PASS
2. Log to `aidlc-docs/audit.md`:
   - Timestamp
   - Unit name
   - Code review verdict and summary
   - Test results summary
   - Gate outcome: PASSED

3. Present the final summary:

```
========================================
  Quality Gate Passed: $ARGUMENTS
========================================

Code Review:   GO
Build & Test:  PASS
Unit Status:   Verified

Review Summary:
- [key findings, all resolved]

Test Summary:
- Unit Tests:  N passed / N total
- Integration:  N passed / N total
- Coverage:    N%
========================================
```

4. Suggest next action based on project state:
   - If other units still need quality gates: "다음 unit의 Quality Gate를 실행하세요: `/aidlc-gate [next-unit]`"
   - If all units are verified: "모든 unit이 검증되었습니다. 전체 빌드 테스트를 실행하세요: `/aidlc-test`"
