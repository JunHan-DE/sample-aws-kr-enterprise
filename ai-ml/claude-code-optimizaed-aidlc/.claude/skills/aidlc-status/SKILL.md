---
name: aidlc-status
description: AIDLC Status — 현재 프로젝트 상태를 대시보드 형태로 보여준다
user-invocable: true
---

# AIDLC Status Dashboard

Display the current AIDLC project status as a comprehensive dashboard.

## Procedure

### Step 1 — Load State

Read `aidlc-docs/aidlc-state.md`.

If the file does not exist, respond:
> "AIDLC 프로젝트가 감지되지 않았습니다. `/aidlc-detect`로 프로젝트를 시작하세요."

Then stop.

### Step 2 — Check for Pending Questions

Search for unanswered question files:
1. Glob for all `*-questions.md` files under `aidlc-docs/`
2. For each file found, scan for `[Answer]:` tags that are empty or contain only whitespace
3. Build a list of files with unanswered questions and the count per file

### Step 3 — Display Dashboard

Present the status in the following format:

```
========================================
  AIDLC Project Status Dashboard
========================================

Project: [project name]
Type: [greenfield / brownfield]
Current Phase: [Inception / Construction / Operations]
Current Stage: [specific stage name]

----------------------------------------
  Phase Progress
----------------------------------------
[x] Inception
  [x] Detection & Initialization
  [x] Requirements Gathering
  [x] Story Mapping
  [x] Unit of Work Decomposition
  [x] Execution Planning
[ ] Construction
  [x] Unit: auth — Functional Design
  [~] Unit: auth — NFR Design (in progress)
  [ ] Unit: auth — Infrastructure Design
  [ ] Unit: auth — Code Generation
  [ ] Unit: auth — Quality Gate
  [ ] Unit: api — Functional Design
  ...
[ ] Operations

----------------------------------------
  Unit Status (Construction)
----------------------------------------
| Unit       | Functional | NFR Req | NFR Design | Infra | Code | Gate |
|------------|------------|---------|------------|-------|------|------|
| auth       | done       | done    | ~progress  | -     | -    | -    |
| api        | -          | -       | -          | -     | -    | -    |
| frontend   | done       | -       | -          | -     | -    | -    |

Legend: done = approved, ~progress = in progress, - = not started, skip = skipped per plan

----------------------------------------
  Pending Items
----------------------------------------
[list any unanswered question files with count]

----------------------------------------
  Risk Level
----------------------------------------
[from execution-plan.md if exists]
```

Adapt the dashboard to the actual project state:
- If still in Inception, show only Inception stage progress (no unit table)
- If in Construction, show the full unit status table
- If in Operations, show deployment and monitoring status
- Only show sections that have relevant data

### Step 4 — Alert on Pending Questions

If any unanswered questions were found in Step 2, display a prominent alert:

> "N개의 미답변 질문이 있습니다:
> - `aidlc-docs/construction/auth/nfr-questions.md` (3개 미답변)
> - `aidlc-docs/construction/api/functional-design-questions.md` (5개 미답변)"
