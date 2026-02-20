# 프로젝트 진행 상황

## 현재 상태

**마지막 업데이트**: 2026-02-21
**현재 단계**: 프로덕션 수준 대시보드 6종 80패널 체계 확정, 전체 문서 정합성 확보
**진행률**: 100% (5/5 마일스톤 완료)

| 마일스톤 | 상태 |
|----------|------|
| 인프라 설계 및 CDK 개발 | 완료 |
| CDK 스택 배포 | 완료 |
| 문서화 | **완료** (전체 문서 정합성 검증 및 동기화 완료) |
| Grafana 대시보드 구성 | **완료** (Overview 1종 + Prometheus 1종 + Athena 4종, 총 80패널, 프로덕션 수준 시각화) |
| E2E 검증 및 운영 안정화 | **완료** (메트릭 파이프라인 수정, 이중 파이프라인 검증, 대시보드 중복 제거) |

---

## 완료된 작업

### 2026-02-21: 전체 프로젝트 문서 정합성 검증 및 동기화

- **패널 수 불일치 수정 (77패널 -> 80패널)**
  - 실제 Grafana 대시보드 JSON 파일의 패널 수를 전수 검증
  - 문서에 77패널로 기재되어 있었으나, 실제 JSON에서 카운트한 결과 **80패널**이 정확한 수치
  - 실제 패널 수 (JSON 검증 결과):

    | 대시보드 | JSON 파일 | 실제 패널 수 |
    |----------|-----------|-------------|
    | **Overview** | overview.json | 17 |
    | **Real-Time Metrics** | realtime-metrics.json | 18 |
    | **Cost Deep Analysis** | cost-analysis.json | 10 |
    | **Usage & Session Insights** | usage-insights.json | 10 |
    | **Tool Analytics** | tool-analytics.json | 12 |
    | **API Performance** | api-performance.json | 13 |
    | **합계** | | **80** |

- **문서 5건 일괄 최신화**
  - `docs/progress.md`: 정확한 패널 수(80), 최신 상태 반영, "이어서 할 일" 갱신
  - `docs/architecture.md`: 패널 수 80으로 통일, 대시보드 테이블 정확한 수치 반영
  - `docs/development.md`: 대시보드 파일명 수정(cost.json->cost-analysis.json, usage.json->usage-insights.json), 데이터 소스 UID 정리(prometheus+athena), 패널 수 갱신
  - `docs/dashboard-guide.md`: 80패널 반영, 각 대시보드별 정확한 패널 수 갱신
  - `README.md`: 한국어/영어 섹션 모두 80패널로 통일, 대시보드 테이블 수치 갱신

- **development.md 주요 수정사항**
  - `grafana/dashboards/` 디렉토리 파일명이 실제와 불일치하던 문제 수정
    - `overview.json` -> `overview.json` (유지)
    - `cost.json` -> `cost-analysis.json` (수정)
    - `usage.json` -> `usage-insights.json` (수정)
  - Grafana 데이터 소스 UID 설명 통일: Prometheus=`prometheus`, Athena=`athena`
  - 대시보드 파이프라인 테이블에서 패널 수 갱신

### 2026-02-20: 프로덕션 수준 시각화 개선 (64패널 -> 80패널)

- **대시보드 시각화 전면 개선**
  - 6개 대시보드 전체에 프로덕션 수준 시각화 적용 (64패널 -> 80패널)
  - DA(Data Analyst) 스펙 3건 기반 체계적 개선 (`docs/da1-spec.json`, `da2-spec.json`, `da3-spec.json`)

- **주요 시각화 개선 사항**
  - **게이지 패널**: 비율/비율 지표(Success Rate, Accept Rate, Error Rate)를 게이지 아크로 변환. 임계값 기반 색상(빨간/노란/초록)
  - **스파크라인**: 모든 Stat 패널에 `graphMode: area` 적용하여 추이 표시
  - **그라디언트 채움**: 모든 Time Series 패널에 `gradientMode: scheme` 적용, Bar Chart에 gradient 모드 적용
  - **임계값 기반 색상**: Stat 패널(비용, 토큰, 활성시간), Time Series(임계값 라인/영역), 게이지 패널에 적용
  - **테이블 셀 컬러링**: `color-background` 모드로 비용/지속시간/성능 컬럼에 그라디언트 배경. `gauge` 셀로 비율 컬럼 시각화
  - **드릴다운 데이터 링크**: Stat 패널에서 상세 대시보드로의 드릴다운 링크 추가
  - **신규 패널 16개**: Overview(+5), Real-Time Metrics(+4), Cost Analysis(+3), Usage Insights(+3), Tool Analytics(+1), API Performance(+1) (이전 64패널 대비)

### 2026-02-20: Overview 통합 대시보드 구축

- **Overview 대시보드 신규 생성**
  - Prometheus 실시간 메트릭 + Athena 이벤트 심층 분석을 통합한 Overview 대시보드 생성
  - 모든 대시보드 간 양방향 네비게이션 링크 추가
  - 총 6개 대시보드 체계 완성 (이후 시각화 개선으로 80패널로 확장)

### 2026-02-20: 메트릭 파이프라인 수정 및 Prometheus 대시보드 추가

- **메트릭 파이프라인 장애 진단 및 수정**
  - **근본 원인**: `prometheusremotewrite` exporter (ADOT v0.40.0)가 delta temporality 메트릭을 경고 없이 삭제
  - **수정**: 클라이언트 설정을 cumulative temporality로 변경
  - **검증**: cumulative 카운터로 E2E 테스트 수행, AMP에 8개 메트릭 정상 수신 확인

- **AMP에 수신되는 Prometheus 메트릭 8종 확인**
  - `claude_code_session_count`, `claude_code_lines_of_code_count`, `claude_code_pull_request_count`, `claude_code_commit_count`, `claude_code_cost_usage`, `claude_code_token_usage`, `claude_code_code_edit_tool_decision`, `claude_code_active_time_total`

- **Real-Time Metrics 대시보드 신규 생성** (realtime-metrics.json)

### 2026-02-20: 파티션 등록 아키텍처 개선

- S3 ObjectCreated -> EventBridge -> Lambda -> Glue `BatchCreatePartition` API 방식으로 전환
- 수 초 내 파티션 반영 (기존 최대 1시간 -> 거의 실시간)
- 멱등성 보장 (`AlreadyExistsException` 처리)

### 2026-02-19

- 전체 CDK 스택 배포 완료 (TelemetryStack + 5개 Nested Stack)
- 배포 중 발생한 3가지 문제 해결 (CW Log Group 중복, ADOT 헬스체크, CDK 출력 디렉토리)
- 인프라 검증 완료
- 문서 작성 완료 (architecture, deployment-guide, deployment-result, data-schema, claude-code-setup-guide, otel-schema, cost-estimation, dashboard-design, README)

---

## 진행 중인 작업

현재 모든 핵심 마일스톤이 완료되었습니다. 아래는 운영 개선 사항입니다.

---

## 다음 단계

1. Grafana Alert 규칙 설정 (비용 임계값, API 에러율, 도구 실패율)
2. 다중 사용자 E2E 테스트 (여러 팀에서 동시 수집 검증)
3. 이전 배포 시 생성된 고아 S3 버킷 4개 정리
4. 운영 모니터링 및 대시보드 피드백 반영

---

## 블로커 / 이슈

| 이슈 | 영향 | 해결 방안 | 상태 |
|------|------|----------|------|
| Grafana no data (datasource 누락) | 대시보드 쿼리 실행 안됨 | `target.datasource` 속성 추가, `rawSql` -> `rawSQL` 수정 | **해결** |
| IAM 카탈로그 권한 누락 | Athena 데이터 소스 오류 | CDK에서 `athena:ListDatabases`, `glue:GetDatabase` 등 추가 | **해결** |
| 파티션 프로젝션 성능 | 44,640 가상 파티션으로 쿼리 느림 | `projection.enabled=false`, MSCK 기반 실제 파티션 전환 | **해결** |
| 파티션 수동 등록 필요 | 신규 데이터 조회 안됨 | S3 Event + Glue BatchCreatePartition으로 실시간 등록 | **해결** |
| 메트릭 AMP 미수신 | 메트릭 파이프라인 무동작 | 클라이언트 delta -> cumulative 전환 | **해결** |
| 대시보드 중복 패널 | Prometheus/Athena 간 23개 패널 중복 | 중복 제거 및 역할 분리 | **해결** |
| 문서 패널 수 불일치 | 문서에 77패널, 실제 80패널 | JSON 전수 검증 후 80패널로 전체 문서 통일 | **해결** |
| 고아 S3 버킷 4개 잔존 | 불필요한 리소스 비용 | 수동 삭제 필요 (이전 배포 잔재) | 미해결 |

---

## 의사결정 로그

### 2026-02-21: 패널 수 전수 검증 및 문서 동기화 (77 -> 80)

**배경**: 문서에 "77패널"로 기재되어 있었으나, 실제 Grafana JSON 파일을 파이썬 스크립트로 전수 카운트한 결과 80패널임을 확인
**원인**: DA 스펙 기반 시각화 개선 시 일부 패널 추가분이 문서에 반영되지 않았음. 특히 Overview(16->17), Real-Time Metrics(19->18), Cost(9->10) 등 소폭 차이
**결정**: 모든 문서(README, architecture, development, dashboard-guide, progress)의 패널 수를 실제 JSON 기준 80패널로 통일
**검증 방법**: `python3` 스크립트로 각 JSON의 `panels` 배열을 순회하며 `type!='row'`인 패널과 row 내부 sub-panels를 합산

### 2026-02-20: 대시보드 중복 제거 및 역할 재정의 (6종 74패널 -> 5종 52패널)

**배경**: Prometheus(AMP)와 Athena 대시보드 간 동일/유사 패널이 23개 존재
**결정**: 옵션 2 - 중복 23패널 제거, Athena 전용 4패널 추가, Overview 대시보드 폐지. 최종 5종 52패널
**이유**: Prometheus는 실시간 집계 메트릭(카운터, 비율)에 최적화, Athena는 이벤트 레벨 심층 분석에 최적화

### 2026-02-20: 메트릭 파이프라인 수정

**근본 원인**: `prometheusremotewrite` exporter가 delta temporality 메트릭을 경고 없이 삭제 (ADOT v0.40.0)
**결정**: 클라이언트 cumulative temporality 사용
**이유**: ADOT에 `deltatocumulative` 프로세서 미포함. Prometheus 생태계 기본값이 cumulative

### 2026-02-20: MSCK -> S3 Event 기반 Glue BatchCreatePartition 전환

**결정**: S3 ObjectCreated 이벤트 -> EventBridge -> Lambda -> Glue BatchCreatePartition
**이유**: 실시간 파티션 등록 (수 초 내), Athena 쿼리 비용 제거, 멱등성 보장

### 2026-02-19: Nested Stack 아키텍처 채택

**결정**: 단일 루트 스택(TelemetryStack) + 5개 NestedStack
**이유**: `cdk deploy TelemetryStack` 한 번으로 전체 배포/삭제 가능

### 2026-02-19: ADOT scratch 이미지 헬스체크

**결정**: NLB Target Group HTTP 헬스체크(포트 13133)만 사용
**이유**: scratch 기반 이미지에 셸 없음

---

## 이어서 할 일

> 이 섹션만 읽으면 바로 작업 시작 가능

1. **대시보드 6종 Grafana 임포트 확인 (80패널)**
   - Grafana > Dashboards > Import > Upload JSON file
   - 통합 대시보드 (1종): overview.json (17패널) -> 데이터 소스 UID: `prometheus` + `athena`
   - Prometheus 대시보드 (1종): realtime-metrics.json (18패널) -> 데이터 소스 UID: `prometheus`
   - Athena 대시보드 (4종): cost-analysis.json (10패널), usage-insights.json (10패널), tool-analytics.json (12패널), api-performance.json (13패널) -> 데이터 소스 UID: `athena`

2. **다중 사용자 E2E 테스트**
   - NLB 엔드포인트: `<NLB_DNS_NAME>:4317`
   - 클라이언트 필수 설정: `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative` (또는 미설정으로 기본값 사용)
   - 여러 사용자가 `OTEL_RESOURCE_ATTRIBUTES="team_id=xxx"` 설정 후 데이터 수집 확인

3. **Grafana Alert 규칙 설정**
   - 비용 임계값 알림 (일일 비용 > $X)
   - API 에러율 알림 (> 5%)
   - 도구 실패율 알림 (> 10%)

4. **고아 S3 버킷 정리**
   - 이전 배포 시 생성된 잔존 버킷 4개 수동 삭제

### 참고 컨텍스트

- 대시보드 가이드: `docs/dashboard-guide.md` (6종 80패널)
- 데이터 분석: `docs/data-analysis.md`
- 시각화 요구사항: `docs/dashboard-requirements.md`
- 배포 결과 상세: `docs/deployment-result.md`
- Athena 대시보드 데이터 소스 UID: `athena`
- Prometheus 대시보드 데이터 소스 UID: `prometheus`
- 클라이언트 메트릭 temporality: 반드시 cumulative 사용 (delta 사용 시 AMP 미수신)
- 설계 산출물 (참고용): `docs/dashboard-overlap-analysis.md`, `docs/dashboard-design-spec.md`

---

## 아카이브

<!-- 14일 이상 지난 완료 작업은 여기로 이동 -->
