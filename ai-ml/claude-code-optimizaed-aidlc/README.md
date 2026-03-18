# AIDLC on Claude Code Native

AWS AIDLC(AI-Driven Development Life Cycle) 워크플로우를 Claude Code의 에이전트, 스킬, 훅으로 네이티브 재구현한 프로젝트.

## AIDLC란?

AIDLC는 AI 코딩 에이전트를 위한 적응형 소프트웨어 개발 워크플로우입니다. 3단계로 구성됩니다.

| Phase | 목적 | 핵심 활동 |
|-------|------|-----------|
| **INCEPTION** | 무엇을, 왜 만드는가 | 요구사항 분석, 사용자 스토리, 아키텍처 설계, 작업 분해, 실행 계획 |
| **CONSTRUCTION** | 어떻게 만드는가 | 기능 설계, NFR 설계, 인프라 설계, 코드 생성, 빌드/테스트 |
| **OPERATIONS** | 어떻게 운영하는가 | 배포, 모니터링 (향후 확장) |

AIDLC의 핵심 가치는 **Inception의 깊이 있는 질문-응답 사이클**입니다. AI가 질문 파일을 생성하고, 팀이 토론하며 답변하고, AI가 모호한 답변을 다시 질문하는 과정을 통해 요구사항을 정제합니다. 이 과정은 의도적으로 시간을 투자하며, 워크샵에서 2-3일이 소요될 수 있습니다.

> 원본 프로젝트: [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows)

## 왜 Claude Code Native인가?

원본 AIDLC는 모든 AI 도구에 범용으로 적용하기 위해 **하나의 규칙 텍스트 파일**(CLAUDE.md, AGENTS.md 등)에 모든 워크플로우를 담습니다. Claude Code에서는 이 방식에 한계가 있습니다.

| 관점 | 원본 AIDLC (Rules) | Claude Code Native |
|------|-------------------|-------------------|
| 컨텍스트 비용 | ~30K tokens 상시 로드 | ~73줄 CLAUDE.md + 필요한 skill/agent만 로드 |
| 역할 분리 | 단일 AI가 모든 역할 수행 | 3개 전문 에이전트 (analyst, developer, reviewer) |
| 도구 제한 | "코드를 수정하지 마" 텍스트 지시 | `disallowedTools: Write, Edit` 시스템 수준 차단 |
| 워크플로우 UX | AI가 규칙을 해석하여 진행 | 자연어 자동 라우팅 + `/aidlc-*` 직접 제어 |
| 세션 재개 | "상태 파일을 읽어라" 텍스트 규칙 | SessionStart hook이 자동 감지 및 안내 |
| 감사 로깅 | AI가 수동으로 audit.md 기록 | SubagentStop hook이 자동 기록 |

**Inception의 Q&A 깊이는 그대로 유지합니다.** Claude Code가 개선하는 것은 워크플로우 "관리의 명확성과 자동화"이지, "속도"가 아닙니다.

## 사전 요구사항

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 설치 완료
- Claude Code 계정 및 인증 설정 완료

## 설치

```bash
# 1. 이 프로젝트를 대상 프로젝트 루트에 복사
cp -r .claude/ /path/to/your-project/.claude/

# 2. 대상 프로젝트에서 Claude Code 실행
cd /path/to/your-project
claude
```

`.claude/` 디렉토리가 프로젝트 루트에 있으면 Claude Code가 자동으로 인식합니다.

## 파일 구조

```
.claude/
├── CLAUDE.md                          # 경량 코어 (라우팅 + 컨벤션)
├── settings.json                      # Hooks + Permissions
│
├── agents/                            # 역할별 전문 에이전트
│   ├── aidlc-analyst.md               #   분석/설계 전문가
│   ├── aidlc-developer.md             #   코드 생성 전문가
│   └── aidlc-reviewer.md              #   검증 전문가 (읽기 전용)
│
└── skills/                            # 워크플로우 슬래시 커맨드
    ├── aidlc-detect/SKILL.md          #   /aidlc-detect
    ├── aidlc-reverse/SKILL.md         #   /aidlc-reverse
    ├── aidlc-requirements/SKILL.md    #   /aidlc-requirements
    ├── aidlc-stories/SKILL.md         #   /aidlc-stories
    ├── aidlc-app-design/SKILL.md      #   /aidlc-app-design
    ├── aidlc-units/SKILL.md           #   /aidlc-units
    ├── aidlc-plan/SKILL.md            #   /aidlc-plan
    ├── aidlc-functional/SKILL.md      #   /aidlc-functional [unit]
    ├── aidlc-nfr/SKILL.md             #   /aidlc-nfr [unit]
    ├── aidlc-infra/SKILL.md           #   /aidlc-infra [unit]
    ├── aidlc-code/SKILL.md            #   /aidlc-code [unit]
    ├── aidlc-test/SKILL.md            #   /aidlc-test
    ├── aidlc-status/SKILL.md          #   /aidlc-status
    └── aidlc-gate/SKILL.md            #   /aidlc-gate [unit]
```

실행 중 생성되는 산출물 디렉토리:

```
aidlc-docs/                            # AIDLC 산출물 (자동 생성)
├── aidlc-state.md                     #   프로젝트 상태 추적
├── audit.md                           #   감사 로그
├── inception/
│   ├── plans/                         #   Inception 계획 파일
│   ├── reverse-engineering/           #   역공학 산출물 (brownfield)
│   ├── application-design/            #   아키텍처 설계 산출물
│   ├── requirements.md                #   최종 요구사항
│   ├── stories.md                     #   사용자 스토리
│   ├── personas.md                    #   페르소나
│   └── *-questions.md                 #   팀 질문/답변 파일
└── construction/
    ├── plans/                         #   Construction 계획 파일
    ├── build-and-test/                #   빌드/테스트 결과
    └── {unit-name}/                   #   유닛별 설계 산출물
        ├── functional-design/
        ├── nfr-requirements/
        ├── nfr-design/
        └── infrastructure-design/
```

## 에이전트

3개 에이전트가 AIDLC의 역할을 분담합니다.

### aidlc-analyst (분석/설계 전문가)

Inception 전체와 Construction 설계 단계를 담당합니다. AIDLC의 핵심인 **깊이 있는 질문 생성과 모호성 분석**이 이 에이전트에 내장되어 있습니다.

- **허용 도구**: Read, Write, Glob, Grep, Agent(Explore)
- **금지 도구**: Bash, Edit (코드 실행/수정 불가 -- 문서 생성에만 집중)
- **핵심 행동 규칙**:
  - "When in doubt, ask the question" -- 과잉 확인이 잘못된 가정보다 항상 낫다
  - 모든 질문은 전용 .md 파일에 작성 (채팅 금지)
  - 답변의 모호한 표현("depends", "maybe", "not sure" 등) 자동 탐지
  - 답변 간 모순 탐지 → 후속 질문 파일 생성
  - 모든 모호성이 해소될 때까지 다음 단계 진행 불가

### aidlc-developer (코드 생성 전문가)

Construction 코드 생성 단계를 담당합니다. 반드시 **계획 수립 → 팀 승인 → 코드 생성** 순서를 따릅니다.

- **허용 도구**: Read, Write, Edit, Bash, Glob, Grep (전체)
- **핵심 행동 규칙**:
  - 계획에 없는 코드를 생성하지 않음 (NO EMERGENT BEHAVIOR)
  - 계획 순서를 벗어나지 않음
  - Brownfield: 기존 파일 직접 수정 (복사본 생성 절대 금지)
  - 체크박스 형식 진행 추적

### aidlc-reviewer (검증 전문가)

코드 리뷰와 빌드/테스트를 담당합니다. **코드를 수정할 수 없는** 독립적 검증자입니다.

- **허용 도구**: Read, Bash, Glob, Grep
- **금지 도구**: Write, Edit (시스템 수준에서 코드 수정 차단)
- **두 가지 모드**:
  - Code Review: 설계 문서 대비 코드 검증 → **GO** 또는 **NO-GO** 판정
  - Build & Test: 빌드 실행 + 테스트 실행 → **PASS** 또는 **FAIL** 판정

## 슬래시 커맨드 (Skills)

### Inception Phase

| 커맨드 | 설명 | Q&A |
|--------|------|-----|
| `/aidlc-detect` | 워크스페이스 감지, 상태 파일 초기화 | - |
| `/aidlc-reverse` | 기존 코드베이스 역공학 분석 (brownfield only) | - |
| `/aidlc-requirements [설명]` | 요구사항 분석 -- 깊이 있는 Q&A 사이클 | 핵심 |
| `/aidlc-stories` | 사용자 페르소나 및 스토리 개발 | 있음 |
| `/aidlc-app-design` | 컴포넌트, 서비스, 의존성 설계 | 있음 |
| `/aidlc-units` | 시스템을 개발 단위(unit)로 분해 | 있음 |
| `/aidlc-plan` | Construction 실행 계획 수립 (EXECUTE/SKIP 결정) | - |

### Construction Phase (unit별)

| 커맨드 | 설명 | 에이전트 |
|--------|------|----------|
| `/aidlc-functional [unit]` | 비즈니스 로직, 도메인 모델 설계 | analyst |
| `/aidlc-nfr [unit]` | NFR 요구사항 + NFR 설계 (통합) | analyst |
| `/aidlc-infra [unit]` | 논리 컴포넌트 → 인프라 서비스 매핑 | analyst |
| `/aidlc-code [unit]` | 계획 수립 → 승인 → 코드 생성 | developer |
| `/aidlc-test` | 전체 빌드 및 테스트 실행 | reviewer |

### Utility

| 커맨드 | 설명 |
|--------|------|
| `/aidlc-status` | 현재 프로젝트 상태 대시보드 (미답변 질문 감지 포함) |
| `/aidlc-gate [unit]` | 품질 게이트 파이프라인 (코드 리뷰 → 빌드/테스트) |

## 워크플로우 사용법

### 두 가지 사용 방식

AIDLC 워크플로우는 **자연어**와 **슬래시 커맨드** 두 가지 방식 모두로 진행할 수 있습니다.

#### 방식 1: 자연어 (자동 라우팅)

그냥 만들고 싶은 것을 말하면 AIDLC 워크플로우가 자동으로 시작됩니다.

```
사용자: 온라인 예약 시스템을 만들고 싶어

Claude: (CLAUDE.md 라우팅 규칙에 따라 자동 진행)
        → Workspace Detection 실행
        → "greenfield 프로젝트입니다. Requirements Analysis를 시작합니다."
        → 질문 파일 생성
        → "12개의 질문이 있습니다. 답변해 주세요."
```

각 단계가 팀 승인을 받으면 다음 단계가 자동으로 이어집니다. 팀은 워크플로우를 신경 쓰지 않고 질문에 답변하며 승인만 하면 됩니다.

#### 방식 2: 슬래시 커맨드 (직접 제어)

특정 단계를 직접 지정하거나, 건너뛴 단계를 추가하거나, 특정 단계만 재실행할 때 사용합니다.

```bash
/aidlc-requirements          # 요구사항 분석만 다시 실행
/aidlc-stories               # 건너뛴 사용자 스토리 단계 추가
/aidlc-status                # 현재 진행 상황 확인
/aidlc-gate booking-service  # 특정 unit에 품질 게이트 수동 실행
```

> 워크샵에서는 **방식 1로 시작**하여 자연스럽게 워크플로우에 진입하고, 필요할 때 **방식 2로 직접 제어**하는 것을 권장합니다.

### 빠른 시작 예시

```bash
# Claude Code 실행
claude

# 자연어로 시작 (자동 라우팅)
> 온라인 예약 시스템을 만들고 싶습니다

# 또는 슬래시 커맨드로 시작
> /aidlc-detect
> /aidlc-requirements 온라인 예약 시스템을 만들고 싶습니다

# analyst가 질문 파일 생성 후 안내:
#    "aidlc-docs/inception/requirement-verification-questions.md에
#     12개의 질문이 있습니다. 팀에서 [Answer]: 태그에 답변해 주세요."

# 팀이 파일을 열어 답변 작성 후:
> done

# analyst가 답변 분석 → 모호성 발견 시 후속 질문 생성
#    → 팀 추가 답변 → 반복 → 모든 모호성 해소 후 requirements.md 생성

# 6. 이후 단계 진행
/aidlc-stories
/aidlc-app-design
/aidlc-units
/aidlc-plan

# 7. Construction
/aidlc-functional booking-service
/aidlc-nfr booking-service
/aidlc-infra booking-service
/aidlc-code booking-service
/aidlc-gate booking-service
```

### 질문-응답 사이클 상세

AIDLC의 핵심 메커니즘입니다. 모든 Q&A 기반 스킬에서 동일한 패턴을 따릅니다.

```
1. Skill 실행 (/aidlc-requirements, /aidlc-stories 등)
       │
2. analyst가 질문 파일 생성
   (aidlc-docs/inception/*-questions.md)
       │
3. 팀이 파일을 열어 [Answer]: 태그에 답변 작성
       │
4. 팀: "done" (답변 완료 알림)
       │
5. analyst가 답변 분석
   ├── 빈 답변 → "답변을 완성해 주세요"
   ├── 모호한 표현 → 후속 질문 파일 생성 (*-clarification-questions.md)
   ├── 답변 간 모순 → 후속 질문 파일 생성 (모순 설명 포함)
   └── 모두 명확 → 산출물 생성
       │
6. (후속 질문 시) → 3번으로 돌아가 반복
       │
7. 모든 모호성 해소 → 산출물 생성
       │
8. 팀 승인 대기
   ├── "Request Changes" → 수정 후 재승인
   └── "Approve & Continue" → 다음 단계
```

### 질문 파일 형식

```markdown
## Question 1
이 시스템의 주요 사용자는 누구인가요?

A) 내부 직원만
B) 외부 고객만
C) 내부 직원 + 외부 고객
D) 관리자 + 외부 고객
X) Other (아래 [Answer]: 태그에 직접 기술해 주세요)

[Answer]:

## Question 2
예상 동시 접속자 수는 어느 정도인가요?

A) 100명 미만
B) 100 ~ 1,000명
C) 1,000 ~ 10,000명
D) 10,000명 이상
X) Other (아래 [Answer]: 태그에 직접 기술해 주세요)

[Answer]:
```

팀은 `[Answer]:` 뒤에 선택지 문자(예: `C`) 또는 자유 기술 답변을 작성합니다.

### 세션 재개

멀티데이 워크샵에서 세션이 중단되었을 때:

1. Claude Code를 다시 실행하면 **SessionStart hook**이 자동으로 현재 상태를 감지합니다
2. 현재 Phase, Stage, 미답변 질문 파일이 있으면 자동 안내됩니다
3. `/aidlc-status`로 전체 현황을 확인할 수 있습니다
4. 중단된 단계의 skill을 다시 실행하면 이전 진행 상태부터 이어갑니다

### 품질 게이트 파이프라인

Construction 코드 생성 후 `/aidlc-gate [unit]`으로 실행합니다.

```
/aidlc-gate booking-service

Phase 1: Code Review (aidlc-reviewer)
  ├── 설계 문서 대비 코드 검증
  ├── 보안 취약점 검사 (OWASP Top 10)
  ├── 코드 품질 검사
  └── 판정: GO 또는 NO-GO

Phase 2: Build & Test (GO인 경우만)
  ├── 프로젝트 빌드
  ├── 단위 테스트 실행
  ├── 통합 테스트 실행
  └── 판정: PASS 또는 FAIL

NO-GO 또는 FAIL → 수정 사항 목록 제공 → /aidlc-code로 수정 → 재실행
```

## 워크샵 진행 가이드 (3-5일)

### Day 1: 환경 설정 + Inception 시작

| 시간 | 활동 |
|------|------|
| AM | Claude Code 설치, `.claude/` 구조 배치, 기본 사용법 실습 |
| AM | `/aidlc-detect` 실행 -- 대상 프로젝트 환경 분석 |
| AM | `/aidlc-reverse` 실행 (brownfield인 경우) |
| PM | `/aidlc-requirements` 실행 -- analyst가 질문 파일 생성 |
| PM | **팀 토론**: 질문 파일을 함께 검토하고, 각 질문에 대해 토론 후 답변 작성 |
| PM | "done" → 모호성 분석 → 후속 질문 → 추가 토론 |
| 숙제 | 미완성 답변 마무리, 추가 요구사항 정리 |

### Day 2: Inception 심화

| 시간 | 활동 |
|------|------|
| AM | Requirements 후속 질문 해소 → `requirements.md` 승인 |
| AM | `/aidlc-stories` -- 페르소나/스토리 질문 생성 → 팀 토론 + 답변 |
| PM | 스토리 모호성 해소 → `stories.md` + `personas.md` 승인 |
| PM | `/aidlc-app-design` -- 아키텍처 질문 생성 → 팀 설계 토론 |

### Day 3: Inception 완료 + Construction 진입

| 시간 | 활동 |
|------|------|
| AM | Application Design 후속 질문 해소 → 산출물 승인 |
| AM | `/aidlc-units` -- 작업 단위 분해 |
| AM | `/aidlc-plan` -- 실행 계획 수립 (EXECUTE/SKIP 결정) + 팀 승인 |
| PM | `/aidlc-functional [unit-1]` -- 첫 번째 unit 비즈니스 로직 설계 |
| PM | `/aidlc-nfr [unit-1]` -- NFR 및 기술스택 결정 |

### Day 4: Construction -- 코드 생성

| 시간 | 활동 |
|------|------|
| AM | `/aidlc-infra [unit-1]` -- 인프라 설계 |
| AM | `/aidlc-code [unit-1]` -- 코드 생성 계획 수립 → 팀 승인 → 실행 |
| PM | `/aidlc-gate [unit-1]` -- 코드 리뷰 + 빌드/테스트 |
| PM | NO-GO/FAIL 시 수정 → 재검증 반복 |
| PM | unit-2 시작 (시간 여유 시) |

### Day 5: Construction 완료 + 회고

| 시간 | 활동 |
|------|------|
| AM | 나머지 unit Construction 완료 |
| AM | `/aidlc-test` -- 전체 통합 빌드/테스트 |
| PM | `/aidlc-status` -- 전체 진행 상황 리뷰 |
| PM | `audit.md` 기반 워크플로우 회고 |
| PM | 팀 피드백 + 프로젝트별 커스터마이징 토론 |

> **참고**: 프로젝트 복잡도에 따라 일정은 유동적입니다. 단순 프로젝트는 3일, 복잡한 프로젝트는 5일 이상 소요될 수 있습니다. Inception의 Q&A 깊이를 줄여서 시간을 단축하지 마세요 -- 그것이 AIDLC의 핵심 가치입니다.

## 적응형 깊이 (Adaptive Depth)

AIDLC는 프로젝트 복잡도에 따라 자동으로 깊이를 조절합니다.

| 요소 | 단순 (버그 수정) | 복잡 (시스템 마이그레이션) |
|------|-----------------|------------------------|
| 산출물 목록 | 동일 | 동일 |
| 산출물 내 깊이 | 핵심 사항만 간결하게 | 추적성 포함 포괄적으로 |
| Q&A 질문 수 | 소수 (5-10개) | 다수 (20-40개) |
| 후속 질문 라운드 | 0-1회 | 2-3회 |
| Inception 소요 시간 | 수 시간 | 2-3일 |

깊이 결정 요소: 요청의 명확성, 솔루션 복잡도, 범위, 오류 리스크, 컨텍스트(greenfield/brownfield), 팀 선호도

## Hooks

### SessionStart

세션 시작/재개 시 자동으로 `aidlc-docs/aidlc-state.md`를 확인합니다.
- 프로젝트가 있으면: 현재 Phase, Stage, 미답변 질문 파일 안내
- 프로젝트가 없으면: `/aidlc-detect` 사용 안내

### SubagentStop

AIDLC 에이전트(aidlc-analyst, aidlc-developer, aidlc-reviewer)가 완료될 때마다 `aidlc-docs/audit.md`에 ISO 8601 타임스탬프와 함께 자동 기록합니다.

## 커스터마이징

### 에이전트 모델 변경

각 에이전트의 frontmatter에 `model` 필드를 추가하여 모델을 지정할 수 있습니다.

```yaml
---
name: aidlc-analyst
model: opus        # 또는 sonnet, haiku
---
```

추천 설정:
- **analyst**: opus (깊은 분석과 질문 생성에 유리)
- **developer**: sonnet (빠른 코드 생성에 적합)
- **reviewer**: opus (꼼꼼한 코드 리뷰에 유리)

### MCP 서버 연동

`.claude/settings.json`에 MCP 서버를 추가하면 에이전트가 실제 도구를 활용할 수 있습니다.

```jsonc
{
  "mcpServers": {
    "aws-terraform": { /* Terraform 모듈 검색, validate, plan */ },
    "aws-pricing": { /* AWS 서비스 비용 추정 */ },
    "aws-cdk": { /* CDK 패턴 검색, 보안 검증 */ }
  }
}
```

활용 예시:
- `/aidlc-infra`에서 실제 Terraform 모듈을 검색하여 인프라 설계에 반영
- `/aidlc-nfr`에서 AWS 서비스 비용을 실시간으로 추정
- `/aidlc-code`에서 CDK 보안 규칙 자동 검증

### Permission 조정

프로젝트 필요에 따라 `.claude/settings.json`의 permissions를 조정합니다.

```json
{
  "permissions": {
    "allow": [
      "Read(*)",
      "Glob(*)",
      "Grep(*)",
      "Bash(npm *)",
      "Bash(npx *)"
    ]
  }
}
```

## 문제 해결

### "No AIDLC project found" 메시지

`aidlc-docs/aidlc-state.md`가 없을 때 나타납니다. `/aidlc-detect`로 프로젝트를 초기화하세요.

### 세션 재개 시 상태를 못 읽는 경우

`/aidlc-status`를 실행하여 현재 상태를 수동으로 확인할 수 있습니다.

### 질문 파일 수정 후 반영이 안 되는 경우

`done` 또는 `완료`를 입력하여 analyst가 답변 파일을 다시 읽도록 트리거하세요.

### 에이전트가 도구 권한 오류를 내는 경우

각 에이전트의 tool/disallowedTools 설정이 의도된 것입니다.
- analyst가 Bash를 못 쓰는 것은 정상 (코드 실행 차단)
- reviewer가 Write/Edit를 못 쓰는 것은 정상 (코드 수정 차단)

## 라이선스

이 프로젝트의 AIDLC 워크플로우 설계는 [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows)를 기반으로 합니다.
