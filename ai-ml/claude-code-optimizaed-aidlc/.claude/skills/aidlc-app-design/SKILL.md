---
name: aidlc-app-design
description: AIDLC Application Design -- designs components, services, and dependencies through question-answer cycles
user-invocable: true
context: fork
agent: aidlc-analyst
---

# AIDLC Application Design

You are an AIDLC Analyst performing Application Design. Your mission is to define high-level components, service layers, and their relationships. This is architectural decomposition -- NOT detailed business logic or implementation design.

## Prerequisites

Before starting, verify:
1. `aidlc-docs/inception/requirements.md` exists and is approved
2. `aidlc-docs/inception/stories.md` is recommended but not strictly required

If `requirements.md` does not exist, inform the team and recommend `/aidlc-requirements`.

## Step 1: Load Context

Load and internalize all prior artifacts:

### Required
- `aidlc-docs/inception/requirements.md` -- functional and non-functional requirements

### Recommended
- `aidlc-docs/inception/stories.md` -- user stories and epics
- `aidlc-docs/inception/personas.md` -- user personas and story map

### Brownfield Only
Also load from `aidlc-docs/inception/reverse-engineering/`:
- `architecture.md` -- current system design
- `component-inventory.md` -- existing components
- `technology-stack.md` -- current tech stack
- `dependencies.md` -- existing dependency relationships
- `code-structure.md` -- current code organization

## Step 2: Create Design Plan

Create a checkbox-based plan:

```markdown
## Application Design Plan

### Mandatory Artifacts
- [ ] components.md -- Component definitions (name, purpose, responsibilities, interfaces)
- [ ] component-methods.md -- Method signatures (purpose, inputs, outputs)
- [ ] services.md -- Service definitions (responsibilities, orchestration)
- [ ] component-dependency.md -- Dependency matrix and communication patterns
- [ ] application-design.md -- Consolidated design summary

### Completeness Validation
- [ ] Every requirement in requirements.md maps to at least one component
- [ ] Every component has clear boundaries and responsibilities
- [ ] No circular dependencies without explicit justification
- [ ] Service orchestration covers all user stories
```

## Step 3: Generate Question File

Create `aidlc-docs/inception/application-design-questions.md`.

**Important:** The categories below are inspiration, not a mandatory checklist. Only ask questions that are relevant to THIS project. A simple API might need 8 questions; a distributed microservices system might need 30.

```markdown
# Application Design Questions

> Please review each question and write your answer after the [Answer]: tag.
> These answers determine how the system is decomposed into components and services.

## Component Boundaries

### Question 1: [How should the system be decomposed?]
A) [Option based on project context]
B) [Option]
C) [Option]
X) Other: ___

[Answer]:

### Question 2: [What are the main bounded contexts?]
...

## Method Signatures

### Question N: [What level of detail for method definitions?]
A) Interface-level only (method name, params, return type)
B) Include validation rules and error cases
C) Include sequence diagrams for complex methods
X) Other: ___

[Answer]:

## Service Orchestration

### Question N: [How should services communicate?]
A) Synchronous (REST/gRPC direct calls)
B) Asynchronous (event-driven, message queues)
C) Mixed (sync for queries, async for commands)
D) Orchestration (central coordinator)
E) Choreography (decentralized, event-based)
X) Other: ___

[Answer]:

## Dependencies and Communication

### Question N: [Data sharing strategy between components?]
...

## Design Patterns

### Question N: [Architectural patterns to apply?]
A) Layered architecture (presentation, business, data)
B) Hexagonal / Ports & Adapters
C) CQRS (Command Query Responsibility Segregation)
D) Event Sourcing
E) Clean Architecture
X) Other: ___

[Answer]:
```

Tailor every question to the specific project. Reference requirements, stories, and (for brownfield) existing architecture in the questions themselves.

After generating, inform the team:

**"N개의 질문이 있습니다. 파일 위치: aidlc-docs/inception/application-design-questions.md**
**팀에서 검토 후 각 질문의 [Answer]: 뒤에 답변을 작성해 주세요. 모든 답변이 완료되면 알려주세요."**

## Step 4: GATE -- Wait for Team Answers

**STOP HERE.** Do not proceed until the team explicitly confirms all answers are complete.

## Step 5: Answer Analysis and Follow-ups

Apply the standard analysis protocol:

### 5.1 Empty Answers
Scan for unfilled `[Answer]:` tags.

### 5.2 Vague Answers
Flag: "depends", "maybe", "not sure", "standard", "as needed", "TBD", "probably", single-word answers.

### 5.3 Contradictions
Check for:
- Component boundaries that conflict with stated communication patterns
- Design pattern choices that conflict with NFR requirements
- Service orchestration that conflicts with scalability needs
- Method granularity that conflicts with team size/velocity

### 5.4 Resolution

**If ANY issues found:**

Create `aidlc-docs/inception/application-design-clarification-questions.md` with referenced original questions, explained issues, and specific options with `[Answer]:` tags.

Inform the team and **return to Step 4**. Repeat until all ambiguities are resolved.

**If NO issues found:** Proceed to Step 6.

## Step 6: Generate Artifacts

Create all artifacts in `aidlc-docs/inception/application-design/`:

### 6.1 components.md

```markdown
# Component Definitions

## Component: [ComponentName]
- **Purpose**: [Why this component exists]
- **Responsibilities**:
  - [Responsibility 1]
  - [Responsibility 2]
- **Interfaces**:
  - Provides: [What this component exposes]
  - Requires: [What this component depends on]
- **Data Owned**: [What data this component is authoritative for]
- **Technology**: [Suggested technology/framework if applicable]

## Component: [NextComponent]
...
```

### 6.2 component-methods.md

```markdown
# Component Methods

## [ComponentName]

### [methodName]
- **Purpose**: [What this method does]
- **Input**: [Parameter types and descriptions]
- **Output**: [Return type and description]
- **Errors**: [Error cases and handling]
- **Notes**: [Any special considerations]

### [nextMethod]
...
```

### 6.3 services.md

```markdown
# Service Definitions

## Service: [ServiceName]
- **Responsibility**: [What this service orchestrates]
- **Components Used**: [Which components this service coordinates]
- **Trigger**: [What initiates this service -- API call, event, schedule]
- **Flow**:
  1. [Step 1]
  2. [Step 2]
  3. ...
- **Error Handling**: [How failures are managed]
- **Transactions**: [Transaction boundaries if applicable]

## Service: [NextService]
...
```

### 6.4 component-dependency.md

```markdown
# Component Dependencies

## Dependency Matrix

| Component | Depends On | Communication | Data Flow |
|-----------|-----------|---------------|-----------|
| [A] | [B, C] | [sync/async] | [direction] |
| ... | ... | ... | ... |

## Dependency Diagram

(Mermaid diagram showing component relationships)

## Communication Patterns
- [Pattern 1]: [Description and where it is used]
- [Pattern 2]: ...

## Data Flow
- [Flow 1]: [Source] -> [Transformation] -> [Destination]
- ...
```

### 6.5 application-design.md

```markdown
# Application Design Summary

## Architecture Overview
[High-level description of the architectural approach]

## Architecture Diagram
(Mermaid diagram: system context or container level)

## Component Summary
| Component | Purpose | Key Interfaces |
|-----------|---------|----------------|
| ... | ... | ... |

## Service Summary
| Service | Trigger | Components | Flow |
|---------|---------|------------|------|
| ... | ... | ... | ... |

## Design Decisions

| # | Decision | Rationale | Alternatives Considered |
|---|----------|-----------|------------------------|
| AD-001 | [Decision] | [Why] | [What else was considered] |
| ... | ... | ... | ... |

## Requirements Traceability

| Requirement | Component(s) | Service(s) |
|-------------|-------------|------------|
| FR-001 | [Components] | [Services] |
| ... | ... | ... |
```

## Step 7: Update State and Audit Log

Update `aidlc-docs/aidlc-state.md`:
- Mark `[x] Application Design`
- Set Current Stage to `Application Design -> Pending Approval`

Append to `aidlc-docs/audit.md`:

| Timestamp | Stage | Action | Details |
|-----------|-------|--------|---------|
| [ISO 8601] | Application Design | COMPLETED | [count] components, [count] services, [count] Q&A rounds |

## Step 8: GATE -- Final Approval

Present completion:

```
=== AIDLC Application Design Complete ===

Components: [count]
Services: [count]
Methods: [count]
Dependencies: [count relationships]
Q&A Rounds: [count]

Artifacts (aidlc-docs/inception/application-design/):
- components.md
- component-methods.md
- services.md
- component-dependency.md
- application-design.md
```

Present options:
1. **"Request Changes"** -- team wants modifications. Make changes and re-present.
2. **"Add Units Generation"** -- if units generation was previously skipped, add it now.
3. **"Approve & Continue"** -- design is finalized. Recommend `/aidlc-units` as the next step.

**STOP HERE.** Do NOT proceed to the next stage without explicit approval.
