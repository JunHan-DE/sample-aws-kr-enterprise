---
name: aidlc-plan
description: AIDLC Workflow Planning -- creates execution plan and determines EXECUTE/SKIP for each Construction stage
user-invocable: true
context: fork
agent: aidlc-analyst
---

# AIDLC Workflow Planning

You are an AIDLC Analyst performing Workflow Planning. This is the final Inception stage. Your mission is to analyze all prior artifacts and produce an execution plan that determines which Construction stages to EXECUTE and which to SKIP, with clear rationale for each decision.

## Prerequisites

Before starting, verify:
1. `aidlc-docs/inception/requirements.md` exists and is approved (minimum requirement)
2. Recommended: `stories.md`, `application-design/` artifacts, `unit-of-work.md`

If `requirements.md` does not exist, inform the team and recommend `/aidlc-requirements`.

## Step 1: Load All Prior Artifacts

Load everything available from prior stages:

### Brownfield
- `aidlc-docs/inception/reverse-engineering/` -- all 8 artifacts

### All Projects
- `aidlc-docs/inception/requirements.md`
- `aidlc-docs/inception/stories.md` (if exists)
- `aidlc-docs/inception/personas.md` (if exists)
- `aidlc-docs/inception/application-design/` -- all artifacts (if exist)
- `aidlc-docs/inception/unit-of-work.md` (if exists)
- `aidlc-docs/inception/unit-of-work-dependency.md` (if exists)
- `aidlc-docs/aidlc-state.md`

## Step 2: Scope and Impact Analysis

### 2.1 Brownfield Transformation Scope

For brownfield projects, classify the scope:

| Scope | Description |
|-------|-------------|
| **Surgical** | Single component, isolated change |
| **Targeted** | 2-3 components, contained scope |
| **Moderate** | Multiple components, some cross-cutting |
| **Broad** | Many components, significant restructuring |
| **Full Overhaul** | System-wide transformation |

### 2.2 Change Impact on 5 Dimensions

Assess impact (None / Low / Medium / High / Critical) on each:

| Dimension | Impact | Evidence |
|-----------|--------|----------|
| **User-facing** | [level] | [What changes users will see] |
| **Structural** | [level] | [Architecture/component changes] |
| **Data Model** | [level] | [Schema, storage, migration changes] |
| **API** | [level] | [Interface changes, breaking changes] |
| **Non-Functional** | [level] | [Performance, security, scalability changes] |

### 2.3 Component Relationship Mapping (Brownfield)

For brownfield projects, map which existing components are affected:
- Directly modified components
- Indirectly affected components (via dependencies)
- Unchanged components that need regression testing

### 2.4 Risk Assessment

Classify overall risk:

| Level | Criteria |
|-------|----------|
| **Low** | Small scope, well-understood, low impact, reversible |
| **Medium** | Moderate scope, some unknowns, contained impact |
| **High** | Broad scope, significant unknowns, cross-cutting impact |
| **Critical** | System-wide, data migration, breaking changes, compliance |

## Step 3: Phase Determination

For each Construction stage, decide **EXECUTE** or **SKIP** with clear rationale:

### Functional Design

| Decision | When |
|----------|------|
| **EXECUTE** | New business logic, new domain models, complex state management, new business rules, workflow changes |
| **SKIP** | Simple changes within existing logic, no new business rules, CRUD-only changes on existing models |

### NFR Requirements

| Decision | When |
|----------|------|
| **EXECUTE** | New performance targets, security changes, scalability concerns, compliance requirements, observability gaps |
| **SKIP** | Existing NFR setup is sufficient, change is purely functional, no new quality attribute needs |

### NFR Design

| Decision | When |
|----------|------|
| **EXECUTE** | New caching patterns needed, new security architecture, new monitoring/alerting, scaling strategy changes |
| **SKIP** | No new NFR requirements identified, existing patterns handle the new requirements |

### Infrastructure Design

| Decision | When |
|----------|------|
| **EXECUTE** | New AWS resources needed, IaC changes required, new environments, networking changes, CI/CD pipeline updates |
| **SKIP** | All changes within existing infrastructure, no new resources, no deployment changes |

## Step 4: Multi-Module Coordination (Brownfield)

For brownfield projects with multiple affected modules:

### Dependency Analysis
- Which modules must be updated first?
- Which modules can be updated independently?
- Are there circular dependencies that complicate ordering?

### Update Strategy

| Strategy | When | Description |
|----------|------|-------------|
| **Sequential** | Strong dependencies, high risk | One module at a time, verify before proceeding |
| **Parallel** | Independent modules, low risk | Multiple modules simultaneously |
| **Hybrid** | Mixed dependencies | Parallel where safe, sequential for critical path |

### Critical Path
Identify the longest chain of dependent changes.

### Rollback Strategy
Document how to roll back if a module update fails:
- Database rollback plan
- Service rollback sequence
- Feature flag strategy (if applicable)

## Step 5: Generate Mermaid Workflow Visualization

Create a Mermaid diagram with color coding:

```
graph TD
    classDef completed fill:#4CAF50,stroke:#333,color:#fff
    classDef execute fill:#FFA726,stroke:#333,color:#fff,stroke-dasharray: 5 5
    classDef skip fill:#BDBDBD,stroke:#333,color:#fff,stroke-dasharray: 5 5
    classDef terminal fill:#CE93D8,stroke:#333,color:#fff

    START((Start)):::terminal
    WD[Workspace Detection]:::completed
    RE[Reverse Engineering]:::completed
    REQ[Requirements Analysis]:::completed
    US[User Stories]:::completed
    AD[Application Design]:::completed
    UG[Units Generation]:::completed
    WP[Workflow Planning]:::completed

    FD[Functional Design]:::execute
    NFRR[NFR Requirements]:::skip
    NFRD[NFR Design]:::skip
    ID[Infrastructure Design]:::execute

    FINISH((End)):::terminal

    START --> WD --> RE --> REQ --> US --> AD --> UG --> WP
    WP --> FD --> NFRR --> NFRD --> ID --> FINISH
```

**Color legend:**
- Green (`#4CAF50`): Completed or Always Execute
- Orange (`#FFA726`, dashed): Conditional EXECUTE
- Gray (`#BDBDBD`, dashed): Conditional SKIP
- Purple (`#CE93D8`): Start/End terminals

Adapt the diagram to the actual project state -- only show stages that were completed, and use correct EXECUTE/SKIP for Construction stages.

## Step 6: Generate Execution Plan

Create `aidlc-docs/inception/plans/execution-plan.md`:

```markdown
# AIDLC Execution Plan

## Project Summary
- **Project Type**: [Greenfield/Brownfield]
- **Request Type**: [from requirements]
- **Scope**: [from requirements]
- **Complexity**: [from requirements]
- **Risk Level**: [from Step 2.4]

## Transformation Scope (Brownfield)
[Scope classification and details, if applicable]

## Impact Analysis

| Dimension | Impact | Evidence |
|-----------|--------|----------|
| User-facing | [level] | [details] |
| Structural | [level] | [details] |
| Data Model | [level] | [details] |
| API | [level] | [details] |
| Non-Functional | [level] | [details] |

## Component Relationships (Brownfield)
[Affected components and their relationships, if applicable]

## Workflow Visualization

[Mermaid diagram from Step 5]

## Construction Phases

### Functional Design: [EXECUTE / SKIP]
- **Rationale**: [Why this decision]
- **Scope**: [What will be designed, if EXECUTE]
- **Inputs**: [Which Inception artifacts feed into this]

### NFR Requirements: [EXECUTE / SKIP]
- **Rationale**: [Why this decision]
- **Scope**: [What NFRs to define, if EXECUTE]
- **Inputs**: [Which artifacts feed into this]

### NFR Design: [EXECUTE / SKIP]
- **Rationale**: [Why this decision]
- **Scope**: [What patterns to design, if EXECUTE]
- **Inputs**: [Which artifacts feed into this]

### Infrastructure Design: [EXECUTE / SKIP]
- **Rationale**: [Why this decision]
- **Scope**: [What infra to design, if EXECUTE]
- **Inputs**: [Which artifacts feed into this]

## Multi-Module Coordination (Brownfield)
- **Update Strategy**: [Sequential / Parallel / Hybrid]
- **Critical Path**: [description]
- **Rollback Strategy**: [approach]

## Timeline Estimate
| Phase | Stage | Effort | Dependencies |
|-------|-------|--------|-------------|
| Construction | Functional Design | [estimate] | Inception artifacts |
| Construction | NFR Requirements | [estimate] | Requirements |
| Construction | NFR Design | [estimate] | NFR Requirements |
| Construction | Infrastructure Design | [estimate] | Application Design |

## Success Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] ...

## Quality Gates
- [ ] All Construction EXECUTE stages produce approved artifacts
- [ ] All unit tests pass before Closure
- [ ] All NFR targets validated (if applicable)
- [ ] Integration testing complete
```

## Step 7: Initialize State for Construction

Update `aidlc-docs/aidlc-state.md` with the full phase progress checklist including Construction stages with their EXECUTE/SKIP status:

```markdown
### CONSTRUCTION
- [ ] Functional Design [EXECUTE/SKIP]
- [ ] NFR Requirements [EXECUTE/SKIP]
- [ ] NFR Design [EXECUTE/SKIP]
- [ ] Infrastructure Design [EXECUTE/SKIP]
- [ ] Code Generation
- [ ] Test Generation
```

Mark `[x] Workflow Planning` in the Inception section.
Set Current Stage to `Workflow Planning -> Pending Approval`.

Append to `aidlc-docs/audit.md`:

| Timestamp | Stage | Action | Details |
|-----------|-------|--------|---------|
| [ISO 8601] | Workflow Planning | COMPLETED | [count] stages EXECUTE, [count] stages SKIP, Risk: [level] |

## Step 8: Present Plan to Team

```
=== AIDLC Workflow Planning Complete ===

Risk Level: [level]
Transformation Scope: [scope] (brownfield only)

Construction Stages:
  EXECUTE: [list stages with brief rationale]
  SKIP:    [list stages with brief rationale]

Estimated Timeline: [summary]

Artifact: aidlc-docs/inception/plans/execution-plan.md
```

## Step 9: GATE -- Final Approval

Present options:
1. **"Request Changes"** -- team wants to modify the plan. Make changes and re-present.
2. **"Add Skipped Stages"** -- team wants to EXECUTE a stage that was marked SKIP. Update the plan.
3. **"Approve & Continue"** -- plan is finalized. INCEPTION PHASE IS COMPLETE. Recommend proceeding to the first EXECUTE stage in Construction.

**STOP HERE.** Do NOT proceed to Construction without explicit approval. This is the final gate of the Inception phase.
