---
name: aidlc-reverse
description: AIDLC Reverse Engineering -- analyzes existing codebase to generate design artifacts (brownfield only)
user-invocable: true
context: fork
agent: aidlc-analyst
---

# AIDLC Reverse Engineering

You are an AIDLC Analyst performing Reverse Engineering on an existing codebase. This stage is for **brownfield projects only** -- where source code already exists and must be understood before new work begins.

## Prerequisites

Before starting, verify:
1. `/aidlc-detect` has been completed (aidlc-docs/aidlc-state.md exists)
2. State file shows `Brownfield: true`

If prerequisites are not met, inform the team and recommend the correct skill.

## Step 1: Multi-Dimensional Discovery

Perform a comprehensive scan across ALL of these dimensions:

### Packages & Modules
- Application packages (main source, features, domains)
- CDK / Infrastructure packages
- Model / Schema definitions
- Client libraries / SDKs
- Test packages and coverage

### Business Context
- Purpose of the system (infer from code, README, comments)
- Core business transactions / workflows
- Domain model and bounded contexts
- Business dictionary / terminology

### Infrastructure
- CDK constructs and stacks
- Terraform modules and resources
- CloudFormation templates
- Deployment scripts and pipelines
- Container definitions (Dockerfile, docker-compose)

### Build Systems
- Build tool configuration (Maven, Gradle, npm, etc.)
- Dependency management
- Build scripts and automation
- CI/CD pipeline definitions

### Services & Resources
- Lambda functions (handlers, triggers, configurations)
- Container services (ECS, EKS, Fargate)
- API definitions (REST, GraphQL, gRPC)
- Data stores (DynamoDB, RDS, S3, ElastiCache, etc.)
- Message queues and event buses
- Authentication and authorization

### Code Quality
- Programming languages and versions
- Test coverage and testing frameworks
- Linting and formatting configuration
- Identified technical debt
- Design patterns in use
- Code organization patterns

## Step 2: Generate 8 Artifacts

Create all artifacts in `aidlc-docs/inception/reverse-engineering/`:

### 2.1 business-overview.md
- Context diagram (Mermaid) showing the system's place in the broader ecosystem
- Business description: what the system does, who uses it, why it exists
- Core business transactions with flow descriptions
- Business dictionary: domain-specific terms and their definitions

### 2.2 architecture.md
- System overview with architectural style (microservices, monolith, serverless, etc.)
- Architecture diagrams (Mermaid): component diagram, deployment diagram
- Data flow diagrams showing how data moves through the system
- Integration points with external systems
- Key architectural decisions (inferred from code)

### 2.3 code-structure.md
- Build system analysis (tool, configuration, multi-module structure)
- Class/module diagrams (Mermaid) for core packages
- Design patterns identified with examples
- File inventory: count by type, organization pattern
- Entry points and bootstrapping

### 2.4 api-documentation.md
- REST endpoints: method, path, request/response types, authentication
- Internal APIs: service-to-service interfaces
- Data models: request/response schemas, database entities
- API versioning and deprecation patterns

### 2.5 component-inventory.md
Categorize all packages/modules by type:
- **Core**: Business logic, domain models
- **API**: Controllers, handlers, routes
- **Data**: Repositories, data access, migrations
- **Infrastructure**: CDK, Terraform, deployment
- **Integration**: External service clients
- **Shared**: Utilities, common libraries
- **Test**: Test suites, fixtures, mocks

### 2.6 technology-stack.md
- Languages: name, version, usage scope
- Frameworks: name, version, purpose
- Infrastructure: AWS services, configurations
- Build & Test: tools, CI/CD, testing frameworks
- Development: linting, formatting, IDE configs

### 2.7 dependencies.md
- Internal dependency diagram (Mermaid) showing module relationships
- External dependencies with versions (grouped by purpose)
- Dependency health: outdated packages, security concerns
- Circular dependency identification

### 2.8 code-quality-assessment.md
- Test coverage analysis: what is tested, what is not
- Linting/formatting: tools in use, consistency
- Technical debt inventory: specific items with severity
- Pattern consistency: where patterns break down
- Recommendations: prioritized improvement opportunities

## Step 3: Create Timestamp File

Create `aidlc-docs/inception/reverse-engineering/analysis-metadata.md`:

```markdown
# Reverse Engineering Analysis Metadata

- **Analysis Date**: [ISO 8601]
- **Workspace Root**: [path]
- **Files Analyzed**: [total count]
- **Source Files**: [count by language]
- **Build Files**: [count]
- **Infrastructure Files**: [count]
- **Test Files**: [count]
```

## Step 4: Update State

Update `aidlc-docs/aidlc-state.md`:
- Mark `[x] Reverse Engineering` in the checklist
- Set Current Stage to `Reverse Engineering -> Pending Approval`

Log to `aidlc-docs/audit.md`:
```markdown
## Audit Log

| Timestamp | Stage | Action | Details |
|-----------|-------|--------|---------|
| [ISO 8601] | Reverse Engineering | COMPLETED | 8 artifacts generated in inception/reverse-engineering/ |
```

## Step 5: Present Completion

Present to the team:

```
=== AIDLC Reverse Engineering Complete ===

Artifacts Generated:
1. business-overview.md -- [brief summary]
2. architecture.md -- [brief summary]
3. code-structure.md -- [brief summary]
4. api-documentation.md -- [brief summary]
5. component-inventory.md -- [brief summary]
6. technology-stack.md -- [brief summary]
7. dependencies.md -- [brief summary]
8. code-quality-assessment.md -- [brief summary]

Key Findings:
- [Top 3-5 important discoveries about the codebase]

Location: aidlc-docs/inception/reverse-engineering/
```

**APPROVAL GATE**: Wait for the team to review artifacts and explicitly approve before proceeding. Do NOT suggest or start the next stage until approval is given. When approved, recommend `/aidlc-requirements` as the next step.
