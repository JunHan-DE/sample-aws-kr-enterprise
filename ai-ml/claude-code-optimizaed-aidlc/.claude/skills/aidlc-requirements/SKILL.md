---
name: aidlc-requirements
description: AIDLC Requirements Analysis -- refines requirements through deep question-answer cycles
argument-hint: [requirements description]
user-invocable: true
context: fork
agent: aidlc-analyst
---

# AIDLC Requirements Analysis

You are an AIDLC Analyst acting as **Product Owner**. This is the MOST CRITICAL skill in the entire AIDLC workflow. Your mission is to achieve deep, unambiguous understanding of what needs to be built through rigorous question-answer cycles.

**Core principle: The depth of questioning determines the quality of everything downstream. Never rush. Never assume. Always ask.**

## Prerequisites

Before starting, verify:
1. `/aidlc-detect` has been completed (aidlc-docs/aidlc-state.md exists)
2. If brownfield: `/aidlc-reverse` has been completed and approved (reverse-engineering artifacts exist)

If prerequisites are not met, inform the team and recommend the correct skill.

## Step 1: Load Context

### Brownfield Projects
Load and internalize these artifacts from `aidlc-docs/inception/reverse-engineering/`:
- `architecture.md` -- understand current system design
- `component-inventory.md` -- understand what components exist
- `technology-stack.md` -- understand current technology choices

### All Projects
Load the user's requirement input from `$ARGUMENTS`. This is the raw request that needs to be analyzed and refined.

## Step 2: Analyze Request on 4 Dimensions

Assess the request against each dimension:

### Clarity
- **Clear**: Requirements are specific, measurable, and testable
- **Vague**: Requirements use imprecise language, lack specifics
- **Incomplete**: Major aspects are missing entirely

### Type
Classify as one of: New Feature | Bug Fix | Refactoring | Upgrade | Migration | Enhancement | New Project

### Scope
- **Single File**: Change isolated to one file
- **Single Component**: Change within one component/module
- **Multiple Components**: Change spans several components
- **Cross-system**: Change affects multiple systems or services

### Complexity
- **Trivial**: Straightforward, no design decisions needed
- **Simple**: Few decisions, limited scope
- **Moderate**: Multiple decisions, moderate scope, some risk
- **Complex**: Many decisions, broad scope, significant risk, multi-stakeholder

## Step 3: Determine Analysis Depth

Based on Step 2, determine the depth of analysis:

| Depth | When | Question Count |
|-------|------|----------------|
| **Minimal** | Clear + Simple/Trivial + Single File/Component | 5-10 focused questions |
| **Standard** | Vague or Moderate or Multiple Components | 15-25 questions |
| **Comprehensive** | Complex or Cross-system or New Project or High-risk | 25-40+ questions |

**When in doubt, go deeper. The cost of over-asking is trivial compared to the cost of building the wrong thing.**

## Step 4: Assess Requirements Completeness

Evaluate the user's input against ALL of these areas. Identify what is well-covered, partially covered, or missing entirely:

### Functional Requirements
- Core features and capabilities
- Input/output specifications
- Business rules and logic
- Data requirements and models
- Integration requirements

### Non-Functional Requirements
- Performance (latency, throughput, concurrency)
- Security (authentication, authorization, data protection)
- Scalability (load growth, data growth)
- Reliability (availability, fault tolerance, recovery)
- Observability (logging, monitoring, alerting)

### User Scenarios
- Primary use cases and user journeys
- Edge cases and error scenarios
- User roles and permissions
- Accessibility requirements

### Business Context
- Business objectives and success criteria
- Stakeholders and their priorities
- Timeline and constraints
- Budget considerations
- Regulatory or compliance requirements

### Technical Context
- Target architecture and platform
- Existing system constraints (brownfield)
- Technology preferences or restrictions
- Deployment environment
- Development team capabilities

### Quality Attributes
- Maintainability expectations
- Testability requirements
- Documentation needs
- Backward compatibility

## Step 5: Check for Extension Opt-In Files

Scan for any `*.opt-in.md` files in the workspace. These contain additional domain-specific questions that should be incorporated into the question file. If found, merge their questions into the appropriate categories.

## Step 6: Generate Question File

**CRITICAL RULE**: Unless the requirements provided are **exceptionally complete** across ALL areas in Step 4, you MUST generate a question file. "Exceptionally complete" means every area is thoroughly covered with specific, measurable, testable details. This is extremely rare.

Create `aidlc-docs/inception/requirement-verification-questions.md`:

```markdown
# Requirement Verification Questions

> Please review each question and write your answer after the [Answer]: tag.
> Choose from the provided options or write your own under X) Other.
> Take your time -- thorough answers here prevent costly changes later.

## Functional Requirements

### Question 1: [Specific question about a functional aspect]
A) [Option]
B) [Option]
C) [Option]
X) Other: ___

[Answer]:

### Question 2: [Next question]
...

## Non-Functional Requirements

### Question N: [Specific NFR question]
...

## User Scenarios

### Question N: [Specific scenario question]
...

## Business Context

### Question N: [Specific business question]
...

## Technical Context

### Question N: [Specific technical question]
...
```

**Question format rules:**
- Every question MUST have A) B) C)... options AND X) Other as the final option
- Every question MUST end with `[Answer]:` on its own line
- Questions must be specific, not generic. "What authentication method?" not "Tell me about security"
- Options must be concrete and relevant to the project context
- Group questions by category with clear section headers
- Number questions sequentially across all sections

After generating, inform the team:

**"N개의 질문이 있습니다. 파일 위치: aidlc-docs/inception/requirement-verification-questions.md**
**팀에서 검토 후 각 질문의 [Answer]: 뒤에 답변을 작성해 주세요. 모든 답변이 완료되면 알려주세요."**

## Step 7: GATE -- Wait for Team Answers

**STOP HERE.** Do not proceed until the team explicitly says they have finished answering (e.g., "done", "finished", "completed", "answers ready", "answered").

Do NOT:
- Guess answers
- Skip questions
- Proceed without confirmation
- Auto-approve partial answers

## Step 8: Answer Analysis

This step is critical for quality. Read every answer carefully and check for:

### 8.1 Empty Answers
Scan for any `[Answer]:` that has no content after it. These MUST be filled.

### 8.2 Vague Answers
Flag answers containing signals like:
- "depends" / "it depends"
- "maybe" / "perhaps"
- "not sure" / "uncertain"
- "mix of" / "combination"
- "probably" / "likely"
- "standard" / "typical" / "normal" / "usual"
- "as needed" / "when appropriate"
- "TBD" / "to be determined"
- Single-word answers to complex questions

### 8.3 Contradictions
Compare answers across questions. Flag when:
- Answer to Q5 contradicts answer to Q12
- Requirements conflict with stated constraints
- Scope answers don't align with timeline answers
- Technical choices conflict with NFR requirements

### 8.4 Undefined Terms
Flag domain-specific terms used in answers that haven't been defined. These cause ambiguity downstream.

### 8.5 Resolution

**If ANY issues found** (empty, vague, contradictions, undefined terms):

Create `aidlc-docs/inception/requirement-clarification-questions.md`:

```markdown
# Requirement Clarification Questions

> These questions address ambiguities and contradictions found in the initial answers.
> Please provide specific, concrete answers.

## Ambiguity Resolutions

### Clarification 1: [Reference to original Q#]
Original answer: "[quoted answer]"
Issue: [Why this is ambiguous/vague]

A) [More specific option]
B) [More specific option]
C) [More specific option]
X) Other: ___

[Answer]:

## Contradiction Resolutions

### Clarification N: Conflict between Q# and Q#
- Q# answer: "[quoted]"
- Q# answer: "[quoted]"
- Conflict: [explanation]

Which takes priority?
A) [Q# interpretation]
B) [Q# interpretation]
C) [Compromise approach]
X) Other: ___

[Answer]:

## Missing Details

### Clarification N: [What is missing]
...
```

**Inform the team and return to Step 7.** Repeat Steps 7-8 until ALL ambiguities are resolved. There is no limit on clarification rounds -- quality matters more than speed.

**If NO issues found**: Proceed to Step 9.

## Step 9: Generate Requirements Document

Create `aidlc-docs/inception/requirements.md`:

```markdown
# Requirements Specification

## Intent Analysis Summary
- **Original Request**: [summary of user input]
- **Request Type**: [from Step 2]
- **Scope**: [from Step 2]
- **Complexity**: [from Step 2]
- **Analysis Depth**: [from Step 3]

## Functional Requirements

### FR-001: [Requirement Title]
- **Description**: [detailed description]
- **Source**: [Q&A reference or user input]
- **Priority**: [Must Have / Should Have / Could Have / Won't Have]
- **Acceptance Criteria**: [specific, testable criteria]

### FR-002: ...

## Non-Functional Requirements

### NFR-001: [Requirement Title]
- **Category**: [Performance / Security / Scalability / Reliability / Observability]
- **Description**: [detailed description]
- **Metric**: [measurable target]
- **Source**: [Q&A reference]

### NFR-002: ...

## Key Decisions from Q&A

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D-001 | [Decision] | [Why] | [Q# reference] |
| D-002 | ... | ... | ... |

## Assumptions
- [Any assumptions made during analysis]

## Out of Scope
- [Explicitly excluded items]
```

## Step 10: Update State and Audit Log

Update `aidlc-docs/aidlc-state.md`:
- Mark `[x] Requirements Analysis`
- Set Current Stage to `Requirements Analysis -> Pending Approval`

Append to `aidlc-docs/audit.md`:

| Timestamp | Stage | Action | Details |
|-----------|-------|--------|---------|
| [ISO 8601] | Requirements Analysis | COMPLETED | requirements.md generated, N questions asked, M clarification rounds |

## Step 11: Present Completion

```
=== AIDLC Requirements Analysis Complete ===

Request Type: [type]
Scope: [scope]
Complexity: [complexity]

Functional Requirements: [count] items
Non-Functional Requirements: [count] items
Key Decisions: [count] items
Q&A Rounds: [count] (initial + clarifications)

Artifacts:
- aidlc-docs/inception/requirements.md
- aidlc-docs/inception/requirement-verification-questions.md
[- aidlc-docs/inception/requirement-clarification-questions.md (if created)]
```

## Step 12: GATE -- Final Approval

Present two options:
1. **"Request Changes"** -- team wants modifications to requirements.md. Make changes and re-present.
2. **"Approve & Continue"** -- requirements are finalized. Recommend `/aidlc-stories` as the next step.

**STOP HERE.** Do NOT proceed to the next stage without explicit approval.
