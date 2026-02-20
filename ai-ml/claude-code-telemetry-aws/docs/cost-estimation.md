# 비용 예상

이 문서는 Claude Code Observability Platform의 팀 규모별 예상 AWS 운영 비용을 분석합니다.

> **참고**: 모든 비용은 서울 리전(ap-northeast-2) 기준이며, 2026년 2월 기준 AWS 공시 요금을 참조한 추정치입니다. 실제 비용은 사용 패턴에 따라 달라질 수 있습니다.

---

## 목차

1. [비용 요약](#1-비용-요약)
2. [가정 (Assumptions)](#2-가정-assumptions)
3. [서비스별 비용 상세](#3-서비스별-비용-상세)
4. [팀 규모별 상세 비용](#4-팀-규모별-상세-비용)
5. [비용 최적화 방안](#5-비용-최적화-방안)
6. [제외 항목](#6-제외-항목)

---

## 1. 비용 요약

| 팀 규모 | 월간 예상 비용 (USD) | 1인당 월 비용 (USD) |
|---------|---------------------|-------------------|
| **10명** | $170 ~ $250 | $17 ~ $25 |
| **50명** | $350 ~ $550 | $7 ~ $11 |
| **200명** | $900 ~ $1,500 | $4.5 ~ $7.5 |

팀 규모가 커질수록 1인당 비용이 감소하는 규모의 경제 효과가 있습니다. 이는 고정 비용(NAT Gateway, AMP 기본 요금, Grafana 등)이 분산되기 때문입니다.

---

## 2. 가정 (Assumptions)

### 개발자당 일일 사용 패턴

| 항목 | 10명 규모 | 50명 규모 | 200명 규모 |
|------|----------|----------|-----------|
| 일 평균 세션 수 | 3 | 3 | 2.5 |
| 세션당 평균 API 호출 | 30 | 30 | 25 |
| 세션당 평균 도구 실행 | 50 | 50 | 40 |
| 세션당 프롬프트 입력 | 15 | 15 | 12 |
| 일 평균 총 이벤트 수/인 | ~285 | ~285 | ~232 |
| 월 근무일 | 22 | 22 | 22 |
| 일 근무 시간 | 8시간 | 8시간 | 8시간 |

### 월간 데이터 볼륨

| 항목 | 10명 | 50명 | 200명 |
|------|------|------|-------|
| 총 메트릭 데이터 포인트/월 | ~600K | ~3M | ~10M |
| 총 이벤트 수/월 | ~63K | ~314K | ~1,024K |
| 활성 메트릭 시계열 | ~200 | ~800 | ~2,500 |
| S3 저장량 (Parquet)/월 | ~50 MB | ~250 MB | ~800 MB |

---

## 3. 서비스별 비용 상세

### 3.1 Amazon Managed Prometheus (AMP)

| 항목 | 단가 | 설명 |
|------|------|------|
| 메트릭 수집 | $0.90 / 1000만 샘플 | Remote Write로 수집된 샘플 |
| 메트릭 쿼리 | $0.10 / 10억 샘플 처리 | PromQL 쿼리 시 처리되는 샘플 |
| 메트릭 저장 | $0.03 / GB-월 | 압축된 메트릭 데이터 저장 |

AMP의 최소 비용은 활성 메트릭 시계열 수와 수집 빈도에 따라 결정됩니다.

### 3.2 NAT Gateway

| 항목 | 단가 | 설명 |
|------|------|------|
| 시간당 비용 | $0.045/h | 730시간/월 = ~$32.85/월 |
| 데이터 처리 | $0.045/GB | 아웃바운드 트래픽 |

NAT Gateway는 고정 비용으로, 사용량에 관계없이 월 ~$33 발생합니다. 데이터 처리 비용은 ECR 이미지 풀링과 AWS API 호출에 의해 발생하며 일반적으로 미미합니다.

### 3.3 ECS Fargate

| 항목 | 단가 (서울 리전) | 설명 |
|------|-----------------|------|
| vCPU/시간 | $0.04656/h | 리눅스 ARM64 기준 |
| 메모리 GB/시간 | $0.00511/h | 리눅스 ARM64 기준 |

0.5 vCPU / 1 GB 태스크 1개 기준: ~$0.02839/h = ~$20.72/월

### 3.4 Network Load Balancer

| 항목 | 단가 | 설명 |
|------|------|------|
| 시간당 비용 | $0.0225/h | 730시간/월 = ~$16.43/월 |
| LCU 비용 | $0.006/LCU-h | 실제 처리량에 따라 과금 |

NLB는 고정 비용 + 처리량 기반 비용입니다. 텔레메트리 트래픽은 소량이므로 LCU 비용은 미미합니다.

### 3.5 Amazon Kinesis Data Firehose

| 항목 | 단가 | 설명 |
|------|------|------|
| 데이터 수집 | $0.029/GB | 수집된 데이터 (최소 5KB/레코드) |
| 형식 변환 | $0.018/GB | Parquet 변환 비용 |

### 3.6 Amazon S3

| 항목 | 단가 | 설명 |
|------|------|------|
| Standard 저장 | $0.025/GB-월 | 최초 90일 |
| Standard-IA 저장 | $0.018/GB-월 | 90~365일 |
| Glacier Instant Retrieval | $0.005/GB-월 | 365일 이후 |
| PUT 요청 | $0.005/1000건 | 파일 쓰기 |
| GET 요청 | $0.0004/1000건 | Athena 쿼리 시 |

### 3.7 AWS Glue Data Catalog

| 항목 | 단가 | 설명 |
|------|------|------|
| 저장 | 무료 | 최초 100만 객체 무료 |
| 요청 | 무료 | 최초 100만 요청 무료 |

파티션 프로젝션 사용으로 Glue Crawler 비용이 없습니다.

### 3.8 Amazon Athena

| 항목 | 단가 | 설명 |
|------|------|------|
| 쿼리 비용 | $5.00/TB 스캔 | 스캔된 데이터량 기준 (최소 10MB) |

Parquet 형식 + 파티션 프루닝으로 실제 스캔량은 매우 적습니다.

### 3.9 Amazon Managed Grafana

| 항목 | 단가 | 설명 |
|------|------|------|
| Editor/Admin 라이선스 | $9.00/사용자-월 | 편집 권한 사용자 |
| Viewer 라이선스 | $5.00/사용자-월 | 읽기 전용 사용자 |

---

## 4. 팀 규모별 상세 비용

### 10명 규모

| 서비스 | 월 비용 (USD) | 비고 |
|--------|-------------|------|
| NAT Gateway | $33 | 고정 비용 (1개) |
| ECS Fargate | $21 | 0.5 vCPU / 1 GB x 1 태스크 |
| NLB | $17 | 고정 비용 + 최소 LCU |
| AMP (수집+쿼리+저장) | $15 ~ $30 | ~200 활성 시계열 |
| Firehose | $2 ~ $5 | ~50 MB/월 수집 |
| S3 | $1 ~ $2 | ~50 MB/월 저장 |
| Athena | $1 ~ $3 | 대시보드 쿼리 |
| Glue | $0 | Free Tier |
| Managed Grafana | $9 ~ $18 | 1~2 Editor 라이선스 |
| CloudWatch Logs | $3 ~ $5 | ECS + Firehose 로그 |
| **합계** | **$102 ~ $133** | **기본 인프라 비용** |

**Grafana 사용자 포함**: Viewer 10명 추가 시 +$50, 총 **$152 ~ $183**

**안전 마진 포함** (약 30%): **$170 ~ $250**

### 50명 규모

| 서비스 | 월 비용 (USD) | 비고 |
|--------|-------------|------|
| NAT Gateway | $33 | 고정 비용 |
| ECS Fargate | $21 ~ $42 | 1~2 태스크 (오토스케일링) |
| NLB | $17 ~ $20 | LCU 소폭 증가 |
| AMP (수집+쿼리+저장) | $40 ~ $80 | ~800 활성 시계열 |
| Firehose | $10 ~ $20 | ~250 MB/월 수집 |
| S3 | $3 ~ $7 | ~250 MB/월 + 누적 저장 |
| Athena | $5 ~ $15 | 대시보드 쿼리 증가 |
| Glue | $0 | Free Tier |
| Managed Grafana | $9 ~ $27 | 1~3 Editor 라이선스 |
| CloudWatch Logs | $5 ~ $10 | ECS + Firehose 로그 |
| **합계** | **$143 ~ $254** | **기본 인프라 비용** |

**Grafana Viewer** (최대 50명): +$25 ~ $250 (5~50 Viewer)

**안전 마진 포함**: **$350 ~ $550**

### 200명 규모

| 서비스 | 월 비용 (USD) | 비고 |
|--------|-------------|------|
| NAT Gateway | $33 ~ $66 | 1~2개 (프로덕션 HA 시 2개) |
| ECS Fargate | $42 ~ $104 | 2~5 태스크 (오토스케일링) |
| NLB | $20 ~ $30 | LCU 증가 |
| AMP (수집+쿼리+저장) | $100 ~ $250 | ~2,500 활성 시계열 |
| Firehose | $30 ~ $60 | ~800 MB/월 수집 |
| S3 | $10 ~ $30 | ~800 MB/월 + 누적 저장 |
| Athena | $15 ~ $50 | 대시보드 쿼리 대폭 증가 |
| Glue | $0 | Free Tier |
| Managed Grafana | $18 ~ $45 | 2~5 Editor 라이선스 |
| CloudWatch Logs | $10 ~ $20 | ECS + Firehose 로그 |
| **합계** | **$278 ~ $655** | **기본 인프라 비용** |

**Grafana Viewer** (최대 200명): +$50 ~ $1,000 (10~200 Viewer)

**안전 마진 포함**: **$900 ~ $1,500**

---

## 5. 비용 최적화 방안

### 고정 비용 절감

| 방안 | 절감 효과 | 리스크 |
|------|----------|--------|
| NAT Gateway 1개 유지 (dev) | ~$33/월 | AZ 장애 시 아웃바운드 불가 |
| Fargate Spot 사용 | 최대 70% 할인 | 태스크 중단 가능성 |
| Savings Plan (Fargate) | 최대 52% 할인 | 1~3년 약정 필요 |

### 변동 비용 절감

| 방안 | 절감 효과 | 구현 |
|------|----------|------|
| 메트릭 카디널리티 감소 | AMP 비용 30~50% 감소 | `OTEL_METRICS_INCLUDE_SESSION_ID=false` |
| Grafana Viewer 수 제한 | $5/Viewer-월 절감 | 관리자만 접근 + 공유 대시보드 |
| Athena 쿼리 캐싱 | Athena 비용 50% 이상 감소 | Grafana 쿼리 캐시 설정 |
| S3 수명주기 최적화 | 장기 저장 비용 감소 | 이미 적용됨 (Standard→IA→Glacier) |
| 파티션 프로젝션 | Glue Crawler 비용 제거 | 이미 적용됨 |

### dev 환경 비용 절감

개발 환경에서는 아래 설정으로 비용을 최소화할 수 있습니다:

- `environment: 'dev'` 설정
- ECS 최소 태스크 수 유지 (1개)
- Grafana Editor 라이선스 1개만 사용
- `OTEL_METRICS_INCLUDE_SESSION_ID=false` 로 카디널리티 감소

---

## 6. 제외 항목

이 비용 추정에 포함되지 않은 항목:

| 항목 | 설명 |
|------|------|
| 데이터 전송 비용 | 개발자 PC → NLB 간 데이터 전송 (인바운드 무료) |
| CDK 부트스트랩 S3 | CDK 부트스트랩 버킷 저장 비용 (미미) |
| CloudWatch 메트릭 | ECS Container Insights 기본 메트릭 |
| Route 53 | DNS 레코드 (TLS 적용 시 필요) |
| ACM 인증서 | TLS 적용 시 필요 (무료) |
| VPN/PrivateLink | 보안 강화 시 추가 비용 |
| AWS SSO | IAM Identity Center (무료) |
| 세금 | 국가/지역별 세금 |

---

---

# Cost Estimation (English)

This document analyzes the estimated AWS operational costs of the Claude Code Observability Platform by team size.

> **Note**: All costs are based on the Seoul region (ap-northeast-2) and reference AWS published pricing as of February 2026. Actual costs may vary based on usage patterns.

---

## Cost Summary

| Team Size | Monthly Cost (USD) | Per Developer (USD) |
|-----------|-------------------|-------------------|
| **10 developers** | $170 ~ $250 | $17 ~ $25 |
| **50 developers** | $350 ~ $550 | $7 ~ $11 |
| **200 developers** | $900 ~ $1,500 | $4.5 ~ $7.5 |

Economies of scale reduce per-developer costs as team size grows, since fixed costs (NAT Gateway, AMP base, Grafana) are distributed across more users.

---

## Assumptions

### Daily Usage Pattern Per Developer

| Item | 10-person | 50-person | 200-person |
|------|-----------|-----------|------------|
| Avg sessions/day | 3 | 3 | 2.5 |
| Avg API calls/session | 30 | 30 | 25 |
| Avg tool executions/session | 50 | 50 | 40 |
| Avg prompts/session | 15 | 15 | 12 |
| Total events/person/day | ~285 | ~285 | ~232 |
| Working days/month | 22 | 22 | 22 |

---

## Service Cost Breakdown

### Fixed Costs (Monthly)

| Service | Cost | Notes |
|---------|------|-------|
| NAT Gateway | ~$33 | Fixed hourly rate ($0.045/h) |
| NLB | ~$17 | Fixed hourly rate + minimal LCU |
| ECS Fargate (1 task) | ~$21 | 0.5 vCPU / 1 GB, 24/7 |
| Managed Grafana (1 Editor) | $9 | Per Editor license |

**Total fixed costs**: ~$80/month

### Variable Costs

| Service | Unit Price | Description |
|---------|-----------|-------------|
| AMP Ingestion | $0.90 / 10M samples | Metrics collected |
| AMP Query | $0.10 / 1B samples | PromQL queries |
| Firehose | $0.029/GB + $0.018/GB (conversion) | Data ingestion |
| S3 Standard | $0.025/GB-month | First 90 days |
| Athena | $5.00/TB scanned | SQL queries |
| Grafana Viewer | $5.00/user-month | Read-only access |

---

## Cost by Team Size

### 10 Developers: $170 ~ $250/month

| Service | Monthly (USD) |
|---------|-------------|
| Fixed infra (NAT+NLB+ECS) | $71 |
| AMP | $15 ~ $30 |
| Firehose + S3 | $3 ~ $7 |
| Athena | $1 ~ $3 |
| Grafana (1 Editor + Viewers) | $9 ~ $59 |
| CloudWatch Logs | $3 ~ $5 |
| **Subtotal + safety margin** | **$170 ~ $250** |

### 50 Developers: $350 ~ $550/month

| Service | Monthly (USD) |
|---------|-------------|
| Fixed infra (NAT+NLB+ECS 1-2) | $71 ~ $92 |
| AMP | $40 ~ $80 |
| Firehose + S3 | $13 ~ $27 |
| Athena | $5 ~ $15 |
| Grafana (Editors + Viewers) | $34 ~ $277 |
| CloudWatch Logs | $5 ~ $10 |
| **Subtotal + safety margin** | **$350 ~ $550** |

### 200 Developers: $900 ~ $1,500/month

| Service | Monthly (USD) |
|---------|-------------|
| Fixed infra (NAT x2+NLB+ECS 2-5) | $95 ~ $200 |
| AMP | $100 ~ $250 |
| Firehose + S3 | $40 ~ $90 |
| Athena | $15 ~ $50 |
| Grafana (Editors + Viewers) | $68 ~ $1,045 |
| CloudWatch Logs | $10 ~ $20 |
| **Subtotal + safety margin** | **$900 ~ $1,500** |

---

## Cost Optimization

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Keep single NAT Gateway (non-prod) | ~$33/month | AZ failure risk |
| Use Fargate Spot | Up to 70% on compute | Task interruption possible |
| Fargate Savings Plan | Up to 52% | 1-3 year commitment |
| Reduce metric cardinality | 30-50% AMP savings | Less granular analysis |
| Limit Grafana Viewer licenses | $5/viewer/month | Restrict dashboard access |
| Grafana query caching | 50%+ Athena savings | Slightly stale data |

---

## Exclusions

The following are not included in this estimate:

- Data transfer costs (inbound to NLB is free)
- CDK bootstrap S3 bucket storage
- CloudWatch Container Insights detailed metrics
- Route 53 DNS (if TLS is added)
- VPN/PrivateLink costs (if security hardened)
- Taxes
