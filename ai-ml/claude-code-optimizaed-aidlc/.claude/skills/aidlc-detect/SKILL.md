---
name: aidlc-detect
description: AIDLC Workspace Detection -- analyzes project environment and creates state file
user-invocable: true
context: fork
agent: aidlc-analyst
---

# AIDLC Workspace Detection

You are an AIDLC Analyst performing Workspace Detection. This is the entry point for every AIDLC project. Your job is to understand what exists and guide the team to the correct next step.

## Step 1: Check for Existing AIDLC Project

Look for `aidlc-docs/aidlc-state.md` in the workspace.

**If found:**
- Read the state file completely
- Summarize current state to the team: project type, current phase, current stage, brownfield status
- Based on the state, advise which skill to run next (e.g., `/aidlc-requirements`, `/aidlc-reverse`, `/aidlc-stories`, etc.)
- **STOP HERE** -- do not re-run detection

**If not found:**
- Proceed to Step 2

## Step 2: Workspace Scan

Scan the workspace systematically across these categories:

### Source Files
Scan for: `.java`, `.py`, `.js`, `.ts`, `.tsx`, `.jsx`, `.kt`, `.go`, `.rs`, `.cpp`, `.c`, `.cs`, `.rb`, `.swift`, `.scala`, `.php`, `.dart`, `.vue`, `.svelte`

### Build Files
Scan for: `pom.xml`, `build.gradle`, `build.gradle.kts`, `package.json`, `Cargo.toml`, `go.mod`, `requirements.txt`, `pyproject.toml`, `setup.py`, `Gemfile`, `Makefile`, `CMakeLists.txt`, `pubspec.yaml`, `Package.swift`, `build.sbt`

### Infrastructure as Code
Scan for: `cdk.json`, `cdk.context.json`, `*.tf`, `*.tfvars`, `template.yaml`, `template.json`, `serverless.yml`, `docker-compose.yml`, `Dockerfile`, `*.bicep`, `pulumi.yaml`

### Record
- Languages detected (with file counts)
- Build system(s) identified
- Project structure (monorepo, multi-module, single project)
- Workspace root path

## Step 3: Determine Project Type and Next Phase

| Condition | brownfield | Next Step |
|-----------|-----------|-----------|
| No source code found | `false` | `/aidlc-requirements` (greenfield) |
| Source code exists, no RE artifacts in `aidlc-docs/inception/reverse-engineering/` | `true` | `/aidlc-reverse` |
| Source code exists + RE artifacts already present | `true` | `/aidlc-requirements` |

## Step 4: Create State File

Create `aidlc-docs/aidlc-state.md` with this structure:

```markdown
# AIDLC Project State

## Project Information
- **Project Type**: [Greenfield / Brownfield]
- **Start Date**: [ISO 8601, e.g., 2026-03-18]
- **Workspace Root**: [absolute path]
- **Languages**: [detected languages]
- **Build System**: [detected build systems]

## Phase Progress

### INCEPTION
- [x] Workspace Detection
- [ ] Reverse Engineering (brownfield only)
- [ ] Requirements Analysis
- [ ] User Stories
- [ ] Application Design
- [ ] Units Generation
- [ ] Workflow Planning

### CONSTRUCTION
(initialized after Workflow Planning)

### CLOSURE
(initialized after Construction)

## Current Status
- **Current Phase**: INCEPTION
- **Current Stage**: Workspace Detection -> Complete
- **Brownfield**: [true/false]
```

## Step 5: Output Summary

Present findings to the team:

```
=== AIDLC Workspace Detection Complete ===

Project Type: [Greenfield/Brownfield]
Languages: [list]
Build System: [list]
Workspace Root: [path]

Next Step: [/aidlc-reverse or /aidlc-requirements]
[Brief explanation of why this is the next step]
```

**This stage is informational -- no approval gate required. The team can immediately proceed to the recommended next step.**
