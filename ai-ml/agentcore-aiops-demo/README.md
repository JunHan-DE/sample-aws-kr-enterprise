# AIOps Demo Platform

AWS 환경에서 LLM 기반 멀티 에이전트가 장애를 자동 감지 → RCA 분석 → 조치 권장 → 사용자 승인 후 자동 복구하는 데모 플랫폼입니다.

## 개요

CloudWatch 알람이 발생하면 EventBridge → SQS를 통해 Orchestrator Lambda가 트리거되고, Bedrock AgentCore 위에서 동작하는 멀티 에이전트 RCA Graph(Collector → Writer → Reviewer)가 근본 원인을 분석합니다. 분석 결과는 한국어 RCA 리포트로 생성되며, 사용자가 Web UI에서 권장 조치를 확인하고 승인하면 Executor Agent가 자동으로 복구를 수행합니다. 별도의 Chatbot Agent를 통해 자연어로 알람 이력 조회, 실시간 인프라 조사, RCA 요청이 가능합니다.

## 주요 기능

- **자동 RCA 분석**: CloudWatch 알람 발생 시 멀티 에이전트 그래프가 자동으로 근본 원인을 추적하고 한국어 리포트 생성
- **Reflexion 패턴**: Collector → Writer → Reviewer 순환 구조로 리포트 품질을 자체 검증, 최대 3회 반복
- **Agent as Tools**: 4개 Specialist Agent(Logs, Metrics, Infrastructure, Knowledge)를 tool로 호출하는 계층적 에이전트 구조
- **사용자 승인 후 실행**: AI가 CLI 명령어 + Python 코드를 제시, 사용자가 확인 후 승인하면 Executor Agent가 실행
- **안전한 조치**: 14개 Write API만 허용, 파괴적 API(`TerminateInstances`, `DeleteDBInstance`, `iam:*` 등) 완전 차단
- **워크로드 독립**: AIOps 플랫폼과 워크로드 간 결합 없음, DynamoDB 등록 기반으로 알람 prefix 매칭
- **RAG 기반 지식 검색**: Bedrock Knowledge Base + OpenSearch Serverless로 런북/아키텍처 문서 검색
- **WebSocket 채팅**: timeout 제한 없는 WebSocket API로 복잡한 분석도 가능, AgentCore Memory로 대화 기억
- **실시간 알림**: RCA 완료 시 Slack(Webhook) 자동 발송

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 18, MUI 7, react-router-dom 6, react-markdown (GFM) |
| Backend API | API Gateway (REST + WebSocket), Lambda (Python 3.12) |
| Agent Runtime | Strands Agents, Bedrock AgentCore Runtime (Docker arm64) |
| LLM | Claude Sonnet 4.6 (`global.anthropic.claude-sonnet-4-6`) |
| RAG | Bedrock Knowledge Base, Amazon Titan Embed v2, OpenSearch Serverless |
| Data Store | DynamoDB (workloads, reports, snapshots) |
| Storage | S3 (knowledge, build, web) |
| Messaging | EventBridge, SQS |
| CDN / Hosting | CloudFront + S3 (SPA 호스팅) |
| Container Build | ECR + CodeBuild (Agent 컨테이너 자동 빌드) |
| IaC | AWS CDK 2 (TypeScript, 2개 독립 스택) |

## 아키텍처

```
CloudWatch Alarm
  │
  ▼
EventBridge ──► SQS Queue ──► Orchestrator Lambda (concurrency 5)
                                    │
                           ┌────────▼────────┐
                           │    DynamoDB      │
                           │ (즉시 "분석 중") │
                           └────────┬────────┘
                                    │
                              AgentCore Runtime
                           ┌────────▼────────┐
                           │   RCA Graph      │
                           │ Collector→Writer │
                           │   →Reviewer      │
                           └────────┬────────┘
                                    │
                           DynamoDB 업데이트 + Slack 알림

사용자 ──► CloudFront ──► S3 (React SPA)
             │
             ├─► API Gateway (REST) ──► API Handler Lambda
             │                              ├─ 워크로드 CRUD
             │                              ├─ 리포트 조회/삭제
             │                              └─ 승인 → Executor Agent
             │
             └─► API Gateway (WebSocket) ──► WS Handler Lambda
                                                └─ Chatbot Agent (Memory 연동)
```

### 데이터 흐름

1. **감지**: CloudWatch 알람 → EventBridge → SQS Queue로 이벤트 전달
2. **즉시 저장**: Orchestrator Lambda가 DynamoDB에 "분석 중" 리포트를 즉시 생성 (Web UI에 바로 표시)
3. **워크로드 매칭**: 알람 이름을 DynamoDB `alarm_prefixes`와 매칭하여 워크로드 컨텍스트 로드
4. **RCA 분석**: AgentCore Runtime에서 RCA Graph 실행 (Collector → Writer → Reviewer, 최대 3회 반복)
5. **리포트 완성**: DynamoDB "분석 중" → "대기 중"으로 업데이트, Slack 알림 발송
6. **승인 실행**: 사용자가 Web UI에서 승인 → Executor Agent가 조치 실행 → before/after 상태 비교

### 멀티 에이전트 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                      AgentCore Runtime                          │
│                                                                 │
│  Entrypoint ──┬── agent=rca ────► RCA Graph                     │
│               ├── agent=chatbot ► Chatbot Agent                 │
│               └── agent=executor► Executor Agent                │
│                                                                 │
│  ┌─ RCA Graph (Reflexion Pattern) ────────────────────────────┐ │
│  │                                                            │ │
│  │  Collector ──► Writer ──► Reviewer ──┬── PASS ──► 최종 리포트│
│  │      ▲          (한국어)    (품질검증) └── FAIL ──┘ (최대 3회)│
│  │      │                                                     │ │
│  │      ├── Logs Agent (CloudWatch Logs·CloudTrail·Config)    │ │
│  │      ├── Metrics Agent (CloudWatch Metrics)                │ │
│  │      ├── Infrastructure Agent (EC2·ALB·RDS·SG·ASG·ECS)    │ │
│  │      └── Knowledge Agent (Bedrock KB — Runbook·RAG)        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ Chatbot Agent (한국어) ───────────────────────────────────┐ │
│  │  tools: Logs, Metrics, Infrastructure, Knowledge Agent     │ │
│  │         RCA Graph, query_reports, query_alarms             │ │
│  │  memory: AgentCore Memory (단기 6턴 + 장기 시맨틱)         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ Executor Agent ───────────────────────────────────────────┐ │
│  │  Infrastructure Agent (실행 전/후 상태 확인)               │ │
│  │  Remediation Agent (14개 AWS 조작 도구)                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 시작하기

### 사전 요구사항

- AWS CLI v2 설정 완료 (`aws configure`)
- Node.js 18+
- Python 3.12+
- AWS CDK CLI (`npm install -g aws-cdk`)
- Bedrock Claude Sonnet 4.6 모델 액세스 활성화

### 배포

#### 1. AIOps 플랫폼 + Web UI

```bash
cd infra
npm install
AWS_DEFAULT_REGION=ap-northeast-2 npx aws-cdk bootstrap
AWS_DEFAULT_REGION=ap-northeast-2 npx aws-cdk deploy AiopsPlatformStack --require-approval never
```

CDK가 자동으로 Web UI 빌드(`npm run build`) → S3 배포 → CloudFront invalidation까지 수행합니다.

배포 완료 후 출력:

```
Outputs:
  AiopsPlatformStack.WebUrl = https://xxxx.cloudfront.net
  AiopsPlatformStack.ApiUrl = https://xxxx.execute-api.ap-northeast-2.amazonaws.com/prod/
  AiopsPlatformStack.WsUrl = wss://xxxx.execute-api.ap-northeast-2.amazonaws.com/prod
  AiopsPlatformStack.KnowledgeBaseId = XXXXXXXXXX
  AiopsPlatformStack.AgentRuntimeArn = arn:aws:bedrock-agentcore:ap-northeast-2:xxxx:runtime/aiops_demo_agent-xxxx
```

자동으로 배포되는 리소스:
- Lambda (Orchestrator, API Handler, WebSocket Handler)
- API Gateway (REST + WebSocket), DynamoDB 3개 테이블, S3 3개 버킷, SQS
- OpenSearch Serverless Collection (벡터 검색)
- Bedrock Knowledge Base + S3 Data Source
- AgentCore Runtime + Endpoint + Memory (Strands Agent 컨테이너)
- CloudFront + S3 (Web UI 자동 빌드/배포)
- ECR + CodeBuild (Agent 컨테이너 자동 빌드)

#### 2. Sample App (선택 — 데모용)

```bash
AWS_DEFAULT_REGION=ap-northeast-2 npx aws-cdk deploy AiopsSampleAppStack --require-approval never
```

3-tier 샘플 워크로드(ALB + ASG + RDS)와 9개 CloudWatch 알람이 자동 생성됩니다.

## Web UI 페이지

### 대시보드 (`/`)
- 알람 상태 요약 (OK / ALARM 카운트)
- 최근 RCA 리포트 목록

### 워크로드 (`/workloads`)
- 워크로드 등록/수정/삭제
- Alarm Prefix 매핑, 알림 설정 (Slack)

### 워크로드 상세 (`/workloads/:id`)
- 워크로드 정보 편집
- Knowledge Base 문서 관리 (업로드/목록/삭제)
- KB 동기화 버튼 (동기화 상태 + 처리 건수 표시)

### RCA 리포트 (`/reports/:id`)
- RCA 분석 결과 (요약, 타임라인, 근본 원인, 영향 범위)
- 권장 조치 목록 (CLI 명령어 + Python 코드 표시)
- 승인 및 실행 버튼 → Executor Agent 호출

### 채팅 (`/chat`)
- WebSocket 기반 실시간 채팅 (timeout 없음)
- GFM Markdown, 테이블 렌더링 지원
- AgentCore Memory 연동 (단기: 최근 6턴, 장기: 시맨틱 추출)

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/workloads` | 워크로드 목록 조회 |
| POST | `/api/workloads` | 워크로드 등록 |
| GET | `/api/workloads/{id}` | 워크로드 상세 조회 |
| PUT | `/api/workloads/{id}` | 워크로드 수정 |
| DELETE | `/api/workloads/{id}` | 워크로드 삭제 |
| POST | `/api/workloads/{id}/upload-url` | 문서 업로드 Presigned URL 발급 |
| GET | `/api/workloads/{id}/documents` | 업로드된 문서 목록 조회 |
| DELETE | `/api/workloads/{id}/documents` | 문서 삭제 |
| POST | `/api/workloads/{id}/sync` | Knowledge Base 동기화 |
| GET | `/api/reports` | RCA 리포트 목록 조회 |
| GET | `/api/reports/{id}` | RCA 리포트 상세 조회 |
| DELETE | `/api/reports/{id}` | RCA 리포트 삭제 |
| POST | `/api/reports/{id}/approve` | 권장 조치 승인 및 실행 |
| GET | `/api/status` | 알람 상태 요약 + WebSocket URL |
| POST | `/api/chat` | 채팅 (REST fallback) |
| WebSocket | `sendMessage` | 채팅 (WebSocket, 권장) |

## 프로젝트 구조

```
aiops-demo/
├── infra/                          # AWS CDK 인프라 (TypeScript)
│   ├── bin/app.ts                  # CDK 앱 엔트리포인트
│   └── lib/
│       ├── aiops-platform-stack.ts # AIOps 플랫폼 스택
│       └── sample-app-stack.ts     # 샘플 3-tier 앱 스택
├── src/
│   ├── sample-app/                 # Flask 헬스체크 앱 (데모용)
│   │   └── app.py
│   ├── lambdas/
│   │   ├── orchestrator/           # 알람 → 워크로드 매칭 → AgentCore 호출
│   │   │   └── handler.py
│   │   ├── api_handler/            # REST API (워크로드 CRUD, 리포트, 승인)
│   │   │   └── handler.py
│   │   ├── ws_handler/             # WebSocket 채팅 핸들러
│   │   │   └── handler.py
│   │   └── oss_index_creator/      # OpenSearch 인덱스 생성 (Custom Resource)
│   │       └── handler.py
│   └── agents/app/                 # Strands Agents (AgentCore Runtime)
│       ├── agent.py                # RCA Graph + Chatbot + Executor 라우팅
│       ├── tools.py                # Specialist Agents + 조사/조치 도구
│       ├── Dockerfile              # Python 3.12 slim, arm64
│       └── requirements.txt
├── web-ui/                         # React SPA (MUI, 한국어)
│   ├── src/
│   │   ├── App.js                  # 라우팅 + 레이아웃
│   │   ├── api.js                  # API 클라이언트
│   │   └── pages/
│   │       ├── Dashboard.js        # 알람 상태, 최근 리포트
│   │       ├── Workloads.js        # 워크로드 등록/관리
│   │       ├── WorkloadDetail.js   # 상세 + 문서 업로드
│   │       ├── ReportDetail.js     # RCA 리포트 + 승인/실행
│   │       └── Chat.js             # WebSocket 채팅
│   └── package.json
├── knowledge-base/                 # 런북, 시스템 스펙 (시드 데이터)
│   ├── runbooks/
│   └── system-specs/
└── README.md
```

## Agent 도구 목록

### 조사 도구 (Read-only)

| 도구 | 설명 |
|------|------|
| `query_cloudwatch_logs` | CloudWatch Logs Insights 쿼리 |
| `lookup_cloudtrail_events` | CloudTrail API 변경 이력 (누가 무엇을 변경했는지) |
| `get_ec2_console_output` | EC2 인스턴스 시스템 로그 |
| `get_config_history` | AWS Config 리소스 설정 변경 이력 |
| `get_metric_data` | CloudWatch 메트릭 데이터 조회 |
| `describe_alarms` | CloudWatch 알람 상태 조회 |
| `list_metrics` | CloudWatch 메트릭 목록 조회 |
| `describe_instances` | EC2 인스턴스 상태 |
| `describe_target_health` | ALB Target Group 헬스 체크 |
| `check_security_groups` | Security Group 규칙 조회 |
| `describe_db_instances` | RDS 인스턴스 상태 |
| `describe_auto_scaling_groups` | ASG 상태 및 인스턴스 목록 |
| `describe_ecs_services` | ECS 서비스/태스크 상태 |
| `describe_lambda_functions` | Lambda 함수 설정 |
| `describe_nat_gateways` | NAT Gateway 상태 |
| `describe_vpcs` | VPC 상태 |
| `retrieve_from_kb` | Bedrock KB 런북/운영 이력 RAG 검색 |

### 조치 도구 (Write — 특정 API만, 파괴적 API 없음)

| 도구 | 대상 | 조작 |
|------|------|------|
| `reboot_instance` | EC2 | 인스턴스 재부팅 |
| `start_instance` / `stop_instance` | EC2 | 인스턴스 시작/중지 |
| `modify_security_group_ingress` | SG | Inbound 규칙 추가/제거 |
| `modify_security_group_egress` | SG | Outbound 규칙 추가/제거 |
| `set_asg_capacity` | ASG | Desired Capacity 변경 |
| `suspend_asg_processes` / `resume_asg_processes` | ASG | 프로세스 일시중지/재개 |
| `reboot_db_instance` | RDS | DB 인스턴스 재부팅 |
| `register_targets` / `deregister_targets` | ALB | Target 등록/해제 |
| `update_ecs_service` / `stop_ecs_task` | ECS | 서비스 업데이트/태스크 중지 |
| `update_lambda_config` | Lambda | Memory/Timeout 변경 |
| `set_alarm_state` | CloudWatch | 알람 상태 리셋 |

> **금지**: `TerminateInstances`, `DeleteDBInstance`, `iam:*`, `s3:Delete*` 등 파괴적 API

## DynamoDB 스키마

| 테이블 | Partition Key | 용도 | 비고 |
|--------|--------------|------|------|
| `aiops-demo-workloads` | `workload_id` | 워크로드 등록 정보 (이름, 설명, alarm prefix, 알림 설정) | 즉시 조회 |
| `aiops-demo-reports` | `report_id` | RCA 리포트 (ANALYZING → PENDING → APPROVED → RESOLVED) | GSI: `workload-created-index` |
| `aiops-demo-snapshots` | `scenario_id` | 장애 시나리오 스냅샷 | 데모용 |

## CDK 스택 구성

### AiopsPlatformStack

- **DynamoDB**: workloads, reports, snapshots (On-Demand, DESTROY)
- **S3**: knowledge (시드 데이터 자동 배포), build (Agent 소스), web (SPA 호스팅)
- **OpenSearch Serverless**: `aiops-demo-kb` 컬렉션 (VECTORSEARCH)
- **Bedrock KB**: Titan Embed v2 + OpenSearch Serverless + S3 Data Source
- **AgentCore**: Runtime + Endpoint + Memory (30일 보관, 시맨틱 장기 기억)
- **ECR + CodeBuild**: Agent 컨테이너 자동 빌드/배포 (Custom Resource)
- **Lambda**: Orchestrator (30s, concurrency 5), API Handler (120s), WS Handler (300s)
- **API Gateway**: REST (CORS 전체 허용) + WebSocket (sendMessage 라우트)
- **EventBridge → SQS**: CloudWatch 알람 ALARM 상태 변경 이벤트 캡처
- **CloudFront**: S3 Origin (SPA) + API Gateway Origin (`/api/*` 프록시)
### AiopsSampleAppStack

- **VPC**: 2 AZ, Public/Private 서브넷, NAT Gateway 1개
- **ALB + ASG**: t3.micro × 2, Flask 헬스체크 앱
- **RDS**: PostgreSQL 16, t3.micro, 20GB
- **CloudWatch 알람 9개** (`aiops-demo-` prefix):
  - ALB: unhealthy targets, 5XX, 4XX, high latency
  - EC2: CPU high, status check failed
  - RDS: CPU high, storage low, read latency

## 환경 변수

### AgentCore Runtime

| 변수 | 설명 |
|------|------|
| `MODEL_ID` | Bedrock 모델 ID (`global.anthropic.claude-sonnet-4-6`) |
| `KNOWLEDGE_BASE_ID` | Bedrock Knowledge Base ID |
| `REPORTS_TABLE` | DynamoDB reports 테이블명 |
| `WORKLOADS_TABLE` | DynamoDB workloads 테이블명 |
| `MEMORY_ID` | AgentCore Memory ID |
| `WEB_URL` | CloudFront Web UI URL |
| `AWS_REGION` | AWS 리전 (`ap-northeast-2`) |

### Lambda

| 변수 | 대상 Lambda | 설명 |
|------|------------|------|
| `AGENT_RUNTIME_ARN` | Orchestrator, API Handler, WS Handler | AgentCore Runtime ARN |
| `REPORTS_TABLE` | Orchestrator, API Handler | DynamoDB reports 테이블명 |
| `WORKLOADS_TABLE` | Orchestrator, API Handler | DynamoDB workloads 테이블명 |
| `SNAPSHOTS_TABLE` | API Handler | DynamoDB snapshots 테이블명 |
| `KNOWLEDGE_BUCKET` | API Handler | S3 knowledge 버킷명 |
| `KNOWLEDGE_BASE_ID` | API Handler | Bedrock KB ID (sync 트리거용) |
| `KB_DATA_SOURCE_ID` | API Handler | Bedrock KB Data Source ID |
| `WS_ENDPOINT` | WS Handler | WebSocket API 관리 엔드포인트 |

## 워크로드 등록 방법

1. **워크로드** 페이지에서 **워크로드 등록** 클릭
2. 워크로드 정보 입력:
   - **Workload ID**: 고유 식별자 (예: `my-web-app`)
   - **이름**: 표시 이름
   - **설명**: 아키텍처, 리소스, 의존성 등 요약 (에이전트가 초기 컨텍스트로 사용)
   - **Alarm Prefix**: CloudWatch 알람 이름 prefix (쉼표 구분, 예: `my-app-,myapp-`)
   - **Slack Webhook**: Slack 알림 URL
3. 워크로드 상세 페이지에서 **문서 업로드** → S3 → **KB 동기화** 버튼 클릭 → RAG 검색 가능

## 알려진 제한사항

- **RCA Graph 소요 시간**: Collector → Writer → Reviewer 순차 실행으로 3~5분 소요. 복잡한 장애는 feedback loop로 더 길어질 수 있음
- **동시 요청 제한**: 같은 `runtimeSessionId`로 동시 요청 불가. RCA/Executor는 매번 새 UUID 사용, Chatbot은 세션 ID 유지
- **AgentCore 환경변수**: CDK `CfnRuntime` 업데이트 시 환경변수가 반영되지 않는 경우 있음. `update-agent-runtime` CLI로 직접 설정 필요
- **권장 조치 정확도**: AI가 생성하므로 100% 정확하지 않을 수 있음. 반드시 사용자가 CLI 명령어/코드를 확인 후 승인

## 정리

```bash
cd infra
AWS_DEFAULT_REGION=ap-northeast-2 npx aws-cdk destroy AiopsPlatformStack --force
AWS_DEFAULT_REGION=ap-northeast-2 npx aws-cdk destroy AiopsSampleAppStack --force  # 샘플 앱 사용 시
```

## 라이선스

MIT-0 License
