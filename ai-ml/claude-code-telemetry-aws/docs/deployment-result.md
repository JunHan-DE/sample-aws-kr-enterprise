# 배포 결과 (Deployment Result)

## 배포 정보

- **배포 일시**: 2026-02-19 22:40 KST (성공)
- **대상 리전**: us-east-1
- **AWS 계정**: <ACCOUNT_ID>
- **배포 도구**: AWS CDK v2
- **배포 구조**: 단일 루트 스택 (TelemetryStack) + 5개 Nested Stack

## 스택 배포 현황

| 스택 | 상태 | 리소스 |
|------|------|--------|
| **TelemetryStack** (루트) | CREATE_COMPLETE | Nested Stack 오케스트레이션 |
| NetworkNestedStack | CREATE_COMPLETE | VPC, 서브넷, NAT Gateway, Security Group, VPC Flow Logs |
| MetricsNestedStack | CREATE_COMPLETE | Amazon Managed Prometheus (AMP) Workspace |
| EventsNestedStack | CREATE_COMPLETE | S3 버킷, Glue DB/Table, Firehose, Lambda Transformer, Subscription Filter |
| CollectorNestedStack | CREATE_COMPLETE | ECS Fargate 클러스터, ADOT Collector, NLB, Target Groups |
| DashboardNestedStack | CREATE_COMPLETE | Amazon Managed Grafana Workspace |

## 인프라 검증 결과

### 1. ECS 서비스
- **상태**: ACTIVE
- **실행 중인 태스크**: 1/1
- **배포 상태**: COMPLETED
- **ADOT Collector 버전**: v0.40.0
- **컨테이너 로그**: 에러 없음, "Everything is ready. Begin running and processing data."

### 2. NLB 타겟 그룹 헬스체크
| 타겟 그룹 | 대상 IP | 포트 | 상태 |
|-----------|---------|------|------|
| ccotel-grpc-tg-prod | <PRIVATE_IP> | 4317 | **healthy** |
| ccotel-http-tg-prod | <PRIVATE_IP> | 4317 | **healthy** |

### 3. CloudWatch Logs 로그 그룹
| 로그 그룹 | 용도 | 보존 기간 |
|-----------|------|-----------|
| `/ecs/claude-code-telemetry-collector-prod` | ADOT 컨테이너 로그 | 14일 |
| `/claude-code/telemetry-events` | 텔레메트리 이벤트 (OTLP -> CW Logs) | - |
| `/aws/lambda/claude-code-telemetry-firehose-transformer-prod` | Lambda Transformer 로그 | - |
| `/aws/firehose/claude-code-telemetry-events-stream-prod` | Firehose 에러 로그 | - |
| `/vpc/claude-code-telemetry-flow-logs-prod` | VPC Flow Logs | - |
| `/aws/ecs/containerinsights/.../performance` | Container Insights | - |

### 4. Firehose Delivery Stream
- **이름**: `claude-code-telemetry-events-stream-prod`
- **상태**: ACTIVE

### 5. Lambda Transformer
- **이름**: `claude-code-telemetry-firehose-transformer-prod`
- **런타임**: Python 3.12
- **상태**: Active

### 6. Subscription Filter
- **소스**: `/claude-code/telemetry-events`
- **대상**: `claude-code-telemetry-events-stream-prod` (Firehose)

### 7. AMP Workspace
- **ID**: `<AMP_WORKSPACE_ID>`
- **상태**: ACTIVE

### 8. Grafana Workspace
- **이름**: `claude-code-telemetry-grafana-prod`
- **URL**: `https://<GRAFANA_ID>.grafana-workspace.us-east-1.amazonaws.com`
- **상태**: ACTIVE

## 스택 출력값

| 출력 키 | 값 |
|---------|-----|
| CollectorEndpoint (gRPC) | `<NLB_DNS_NAME>:4317` |
| CollectorHttpEndpoint | `<NLB_DNS_NAME>:4318` |
| GrafanaEndpoint | `https://<GRAFANA_ID>.grafana-workspace.us-east-1.amazonaws.com` |

## S3 버킷

| 용도 | 버킷 이름 |
|------|-----------|
| 이벤트 데이터 (Parquet) | `<EVENT_BUCKET_NAME>` |
| 액세스 로그 | `<ACCESS_LOG_BUCKET_NAME>` |

## Glue 데이터베이스
- **데이터베이스**: `claude_code_telemetry`

## 배포 중 발생한 문제 및 해결

### 문제 1: CloudWatch Log Group 이미 존재 (1차 배포 실패)
- **에러**: `Resource of type 'AWS::Logs::LogGroup' with identifier '/aws/lambda/claude-code-telemetry-firehose-transformer-prod' already exists`
- **원인**: 이전 배포에서 생성된 Lambda Log Group이 스택 삭제 후에도 잔존
- **해결**: 수동으로 `aws logs delete-log-group` 실행 후 재배포

### 문제 2: ECS 컨테이너 헬스체크 실패 (2차 배포 실패)
- **에러**: `Task failed container health checks`
- **원인**: ADOT Collector v0.40.0 이미지가 scratch 기반으로, `wget`/`curl` 등 셸 명령어가 없어 ECS 컨테이너 헬스체크 커맨드 실행 불가
- **해결**: ECS 컨테이너 레벨 헬스체크 제거, NLB 타겟 그룹 HTTP 헬스체크(포트 13133)에만 의존하도록 변경
- **수정 파일**: `lib/nested-stacks/collector-stack.ts`

### 문제 3: CDK 출력 디렉토리 잠금 (3차 배포 시)
- **에러**: `Other CLIs are currently reading from cdk.out`
- **원인**: 이전 배포의 백그라운드 프로세스가 `cdk.out` 디렉토리를 점유
- **해결**: `--output cdk.out.deploy` 옵션으로 별도 출력 디렉토리 사용

## 데이터 파이프라인 구성

```
Claude Code (개발자 PC)
    │
    ├─ OTLP gRPC (:4317) ──→ NLB ──→ ECS/ADOT Collector
    │                                      │
    │                                      ├─ Metrics ──→ AMP (Prometheus Remote Write)
    │                                      │                    │
    │                                      │                    └──→ Grafana (시각화)
    │                                      │
    │                                      └─ Logs ──→ CW Logs (/claude-code/telemetry-events)
    │                                                      │
    │                                                      └─ Subscription Filter ──→ Firehose
    │                                                                                    │
    │                                                                                    ├─ Lambda Transformer (Parquet 변환)
    │                                                                                    │
    │                                                                                    └──→ S3 (Parquet)
    │
    └─ OTLP HTTP (:4318) ──→ (위와 동일)
```

## 남은 작업

1. ~~CollectorStack 배포~~ -- 완료
2. Grafana 데이터 소스 (AMP) 연결 설정
3. Grafana 대시보드 구성
4. Claude Code 클라이언트 OTLP 엔드포인트 설정 테스트
5. 이전 배포 시 생성된 고아 S3 버킷 정리 (4개 버킷)
