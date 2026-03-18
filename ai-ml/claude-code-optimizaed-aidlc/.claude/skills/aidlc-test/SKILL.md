---
name: aidlc-test
description: AIDLC Build and Test — 전체 프로젝트를 빌드하고 테스트 스위트를 실행한다
user-invocable: true
context: fork
agent: aidlc-reviewer
---

# AIDLC Build and Test

You are executing the **Build and Test** stage of AIDLC Construction.

This runs a comprehensive build and testing pipeline across all completed units.

## Prerequisites

Before starting, verify:
1. Read `aidlc-docs/aidlc-state.md` — confirm all code generation is complete
2. If any unit's code generation is still in progress, warn the team and ask whether to proceed with partial testing

## Procedure

### Step 1 — Analyze Testing Requirements

Read the project structure and design artifacts to determine applicable test types:
- **Unit tests** — always applicable
- **Integration tests** — if multiple services or external dependencies exist
- **Contract tests** — if APIs are defined between units
- **Security tests** — if security NFRs were defined
- **Performance tests** — if performance NFRs with specific thresholds exist
- **E2E tests** — if user-facing workflows are defined

Document which test types apply and why.

### Step 2 — Execute Build

1. Identify the build tool and version from project configuration files (`package.json`, `pom.xml`, `build.gradle`, `Makefile`, `pyproject.toml`, CDK app, etc.)
2. Install dependencies
3. Configure environment (check for `.env.example`, required env vars, etc.)
4. Execute the build command
5. Verify build success — if build fails, report the error and stop

Record:
- Build tool and version
- Build duration
- Build artifacts produced
- Any warnings

### Step 3 — Run Unit Tests

1. Execute the unit test suite
2. Collect results:
   - Total tests
   - Passed / Failed / Skipped
   - Coverage percentage (if coverage tool is configured)
   - Report file location

If failures exist, log each failure with:
- Test name
- Expected vs. actual
- Stack trace (abbreviated)

### Step 4 — Run Integration Tests (If Applicable)

For each integration test scenario:
1. Set up test environment (mock services, test databases, etc.)
2. Execute integration tests
3. Collect results (same format as unit tests)
4. Tear down test environment

### Step 5 — Run Additional Tests (If Applicable)

Execute any other applicable test types identified in Step 1:
- Contract tests: verify API compatibility between units
- Security tests: dependency audit, SAST scan, secrets detection
- E2E tests: full workflow execution
- Performance tests: load testing against defined thresholds

### Step 6 — Generate Build & Test Summary

Create the summary report at:
`aidlc-docs/construction/build-and-test/build-and-test-summary.md`

```markdown
# Build & Test Summary

## Build
- **Status**: SUCCESS / FAILURE
- **Tool**: [build tool] [version]
- **Duration**: [time]
- **Artifacts**: [list]

## Unit Tests
- **Total**: N | **Passed**: N | **Failed**: N | **Skipped**: N
- **Coverage**: N%
- **Report**: [path]

## Integration Tests
- **Total**: N | **Passed**: N | **Failed**: N
- **Report**: [path]

## Additional Tests
- [type]: PASS/FAIL — [summary]

## Overall Readiness
**PASS** / **FAIL**

### Issues (if FAIL)
1. [issue description and suggested fix]
```

### Step 7 — Update State & Log

1. Update `aidlc-state.md` with build and test results
2. Log to `aidlc-docs/audit.md`:
   - Timestamp
   - Test types executed
   - Results summary
   - Overall verdict

### Step 8 — Present Results

Display the summary and ask:
- If **PASS**: "모든 테스트가 통과했습니다. Operations 단계로 진행할 준비가 되었습니까?"
- If **FAIL**: "테스트 실패 항목이 있습니다. 위 이슈를 해결한 후 다시 실행해 주세요."
