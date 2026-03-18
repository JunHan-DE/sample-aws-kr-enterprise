# AIDLC Enhanced for Claude Code

AIDLC(AI-Driven Development Life Cycle)를 Claude Code의 에이전트, 스킬, 훅으로 네이티브 구현한 프로젝트.
3단계 적응형 소프트웨어 개발 워크플로우를 통해 체계적이고 검증 가능한 개발을 수행한다.

## Workflow State

- **상태 파일**: `aidlc-docs/aidlc-state.md` (현재 Phase, Stage, 진행 상황)
- **감사 로그**: `aidlc-docs/audit.md` (모든 게이트 통과, 에이전트 활동 기록)

## Phase Model

| Phase | 설명 |
|-------|------|
| **INCEPTION** | 프로젝트 탐색, 요구사항 분석, 사용자 스토리, 애플리케이션 설계, 유닛 분할, 워크플로우 계획 |
| **CONSTRUCTION** | 기능 설계, NFR 설계, 인프라 설계, 코드 생성, 코드 리뷰, 빌드/테스트 |
| **OPERATIONS** | 배포, 모니터링, 유지보수 (향후 확장) |

## Workflow Routing (자동 진행)

개발 관련 요청이 들어오면 AIDLC 워크플로우를 자동으로 따른다. 슬래시 커맨드 없이 자연어로도 진행된다.

### 새 프로젝트/기능 요청 시
"~~ 만들어줘", "~~ 개발하고 싶어", "~~ 시스템을 구축하자" 등의 요청이 들어오면:
1. `aidlc-docs/aidlc-state.md` 존재 여부 확인
2. 없으면 → Workspace Detection 자동 실행 → Requirements Analysis 진입
3. 있으면 → 현재 상태를 읽고 다음 단계부터 이어서 진행

### 단계 간 자동 전환
각 단계가 팀 승인("Approve & Continue")을 받으면 다음 단계를 자동 안내하고 진행한다:
- Workspace Detection → Requirements Analysis → User Stories → Application Design → Units Generation → Workflow Planning
- Construction은 execution-plan.md에 따라 EXECUTE로 표시된 단계만 순서대로 진행

### 슬래시 커맨드 = 직접 제어
`/aidlc-*` 커맨드는 특정 단계를 직접 지정하거나 재실행할 때 사용한다:
- 특정 단계만 다시 실행: `/aidlc-requirements`
- 건너뛴 단계 추가: `/aidlc-stories`
- 상태 확인: `/aidlc-status`
- 품질 게이트 수동 실행: `/aidlc-gate [unit]`

## Gate Rules

- 각 단계(Stage) 완료 시 팀의 명시적 승인("Approve") 필요
- 모든 질문은 전용 .md 파일에 작성 (채팅으로 질문하지 않음)
- `[Answer]:` 태그가 비어있거나 모호한 답변이 있으면 진행 불가
- 모호성이 해소될 때까지 다음 단계로 넘어가지 않음
- "When in doubt, ask the question" -- 과잉 확인이 잘못된 가정보다 항상 낫다

## File Conventions

| 유형 | 위치 |
|------|------|
| 애플리케이션 코드 | 워크스페이스 루트 (`./`) |
| 모든 문서/산출물 | `aidlc-docs/` |
| Phase별 계획 | `aidlc-docs/{phase}/plans/` |
| 질문 파일 | 관련 산출물과 같은 디렉토리 |

## Agent Delegation

| 에이전트 | 용도 |
|----------|------|
| **aidlc-analyst** | Inception 전체 단계 + Construction 설계 단계. 질문 생성, 모호성 분석, 설계 문서 작성 |
| **aidlc-developer** | Construction 코드 생성. 승인된 설계에 따른 계획 수립 및 코드 작성 |
| **aidlc-reviewer** | Construction 검증. 코드 리뷰(GO/NO-GO), 빌드/테스트(PASS/FAIL). 읽기 전용 |

## Available Slash Commands

| 명령어 | 설명 |
|--------|------|
| `/aidlc-detect` | 워크스페이스 감지 및 AIDLC 초기화 |
| `/aidlc-reverse` | 기존 코드베이스 역공학 분석 |
| `/aidlc-requirements` | 요구사항 분석 및 질문 생성 |
| `/aidlc-stories` | 사용자 스토리 도출 |
| `/aidlc-app-design` | 애플리케이션 아키텍처 설계 |
| `/aidlc-units` | 구현 유닛 분할 |
| `/aidlc-plan` | 워크플로우 실행 계획 수립 |
| `/aidlc-functional` | 기능 설계 (Construction) |
| `/aidlc-nfr` | 비기능 요구사항 분석 및 설계 |
| `/aidlc-infra` | 인프라 설계 |
| `/aidlc-code` | 코드 생성 실행 |
| `/aidlc-test` | 빌드 및 테스트 실행 |
| `/aidlc-gate` | 게이트 검토 및 승인 처리 |
| `/aidlc-status` | 현재 워크플로우 상태 조회 |

## Adaptive Depth

산출물 목록은 일정하되, 각 산출물의 깊이는 프로젝트 복잡도에 따라 조절된다.
단순 버그 수정이면 간결하게, 시스템 마이그레이션이면 추적성 포함 포괄적으로.

## Session Resumption

세션 시작/재개 시 반드시:
1. `aidlc-docs/aidlc-state.md`를 읽어 현재 Phase/Stage 확인
2. `*-questions.md` 파일 중 미응답 항목 확인
3. 중단된 지점부터 이어서 진행
