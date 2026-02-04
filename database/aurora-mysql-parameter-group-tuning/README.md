# Aurora MySQL 3.10.3 Parameter Group 통합 튜닝 가이드

## 1. 환경 정보

### 대상 환경

| 항목 | 값 | 비고 |
|------|-----|------|
| DB 버전 | Aurora MySQL 3.10.3 | LTS 버전, MySQL 8.0.42 호환 |
| 인스턴스 타입 | db.r7g.8xlarge | Graviton3 (ARM64) |
| vCPU | 32 | 병렬 처리 최적화 가능 |
| Memory | 256 GiB | 대용량 - OOM 보호 필수 |
| Network | 최대 15 Gbps | 고성능 네트워크 |
| 최대 Storage | 256 TiB | 3.10+ 신기능 |

### 소스 환경 (IDC)

| 항목 | 값 |
|------|-----|
| 버전 | MySQL 8.0.35 |
| 환경 | On-Premise |
| 스토리지 | 로컬 디스크 |

---

## 2. 파라미터 변경 요약

### 2.1 IDC 호환성을 위한 변경 (Critical/High)

| 파라미터 | IDC 값 | Aurora 기본값 | 권장값 | 영향도 | 재시작 |
|----------|--------|---------------|--------|--------|--------|
| transaction_isolation | READ-COMMITTED | REPEATABLE-READ | **READ-COMMITTED** | Critical | 불필요 |
| sql_mode | NO_ENGINE_SUBSTITUTION | 0 | **NO_ENGINE_SUBSTITUTION** | High | 불필요 |
| innodb_purge_threads | 4 | 1 | **4** | Medium | 필요 |

### 2.2 Aurora 전용 파라미터 튜닝

| 파라미터 | 현재값 | 권장값 | 우선순위 | 재시작 |
|----------|--------|--------|----------|--------|
| aurora_oom_response | 0 | print,tune,decline,kill_query,kill_connect,tune_buffer_pool | **High** | 불필요 |
| aurora_parallel_query | OFF | ON (OLAP 워크로드 시) | High | 불필요 |
| aurora_disable_hash_join | OFF | OFF (Parallel Query 전제조건) | High | 불필요 |
| aurora_jemalloc_background_thread | OFF | ON | Medium | 필요 |
| aurora_in_memory_relaylog | DEFAULT | ON (Binlog 복제 시) | Medium | 불필요 |
| aurora_binlog_replication_sec_index_parallel_workers | 0 | 8 (Binlog 복제 시) | Medium | 불필요 |
| aurora_jemalloc_dirty_decay_ms | 10000 | 5000~10000 | Low | 불필요 |
| aurora_read_replica_read_committed | OFF | 세션에서 ON (분석쿼리 시) | Low | - |

### 2.3 추가 권장 파라미터

| 파라미터 | Aurora 기본값 | 권장값 | 사유 |
|----------|---------------|--------|------|
| max_connections | ~5000 | 5000~10000 | 256GB 환경에서 검토 |
| performance_schema | ON | ON 유지 | 메모리 트러블슈팅 필수 |
| slow_query_log | OFF | ON | 성능 분석용 |
| long_query_time | 10 | 1~2 | 워크로드에 따라 조정 |
| innodb_print_all_deadlocks | OFF | ON | Deadlock 분석용 |

### 2.4 Aurora 기본값 유지 권장

| 파라미터 | IDC 값 | Aurora 기본값 | 유지 사유 |
|----------|--------|---------------|-----------|
| innodb_flush_log_at_trx_commit | 2 | 1 | ACID 준수, AWS 강력 권장 |
| innodb_adaptive_hash_index | ON | OFF | Aurora Reader에서 미지원, 아키텍처 최적화 |
| innodb_page_cleaners | 4 | 2 | Aurora 스토리지에서 불필요 |
| innodb_strict_mode | OFF | ON | 데이터 무결성 |
| replica_parallel_workers | 1 | 4 | Aurora 복제 최적화 |
| aurora_use_vector_instructions | - | ON | Graviton3 SIMD 최적화 |
| aurora_jemalloc_tcache_enabled | - | ON | 스레드 캐시 최적 |

---

## 3. 상세 분석

### 3.1 IDC 호환성 파라미터

#### 3.1.1 transaction_isolation (Critical - 변경 필수)

| 항목 | IDC | Aurora 기본값 | 권장 |
|------|-----|---------------|------|
| 값 | READ-COMMITTED | REPEATABLE-READ | **READ-COMMITTED** |

**중요성:**
- **가장 중요한 차이점** - 애플리케이션 동작에 직접적 영향
- IDC에서 READ-COMMITTED 사용 중이라면 쿼리 결과/락 동작이 다를 수 있음

**Isolation Level 비교:**

| 특성 | REPEATABLE-READ | READ-COMMITTED |
|------|-----------------|----------------|
| 트랜잭션 내 일관성 | 스냅샷 일관성 유지 | 최신 커밋 데이터 읽기 |
| Phantom Read | 방지 | 발생 가능 |
| 락 보유 시간 | 상대적으로 김 | 상대적으로 짧음 |
| 동시성 | 낮음 | 높음 |
| History List | 더 오래 유지 | 빠르게 정리 |

**변경하지 않을 경우 발생 가능 이슈:**
- 같은 트랜잭션 내 동일 쿼리에서 다른 결과 (IDC에서는 발생, Aurora에서는 미발생)
- 락 대기 시간 증가
- Deadlock 패턴 변화

> **Aurora 특이사항:** Aurora Reader에서 장시간 REPEATABLE-READ 트랜잭션 실행 시 Writer의 Purge를 차단하여 History List Length가 급증할 수 있음. READ-COMMITTED 사용 시 이 문제가 완화됨.

**권장 설정:**
```
transaction_isolation = READ-COMMITTED
```

---

#### 3.1.2 sql_mode (High - 변경 권장)

| 항목 | IDC | Aurora 기본값 | 권장 |
|------|-----|---------------|------|
| 값 | NO_ENGINE_SUBSTITUTION | 0 (없음) | **NO_ENGINE_SUBSTITUTION** |

**분석:**
- `sql_mode = 0`은 모든 SQL 모드가 비활성화된 상태
- IDC에서 `NO_ENGINE_SUBSTITUTION`만 사용 중
- 호환성을 위해 IDC 설정과 동일하게 맞추는 것이 안전

**권장 설정:**
```
sql_mode = NO_ENGINE_SUBSTITUTION
```

---

#### 3.1.3 innodb_flush_log_at_trx_commit (High - Aurora 기본값 유지)

| 항목 | IDC | Aurora 기본값 | 권장 |
|------|-----|---------------|------|
| 값 | 2 | 1 | **1 유지** |

**Aurora의 스토리지 아키텍처가 일반 MySQL과 근본적으로 다릅니다:**

| 설정값 | 일반 MySQL 동작 | Aurora MySQL 동작 |
|--------|----------------|-------------------|
| 1 | 매 트랜잭션마다 디스크 flush | Redo log가 Aurora 스토리지에 쿼럼 달성 대기 |
| 2 | 1초마다 flush | (v3) 1과 동일하게 쿼럼 대기 |
| 0 | 1초마다 flush | Redo log 쿼럼 대기 안함 |

**AWS 공식 권장사항:**
> "We highly recommend that you use the default value of 1. We recommend that your databases be ACID compliant to avoid the risk of data loss in the event of a server restart."

> ⚠️ **Aurora MySQL v3 주의사항:** v3에서 `innodb_flush_log_at_trx_commit`을 1이 아닌 값으로 변경하려면 **반드시** `innodb_trx_commit_allow_data_loss = 1`을 먼저 설정해야 합니다. 이는 데이터 손실 위험을 인정하는 것이므로 **절대 권장하지 않습니다.**

**결론:**
- Aurora 기본값 **1 유지**
- IDC에서 2를 사용한 이유가 성능 때문이라면, Aurora의 분산 스토리지가 이미 최적화되어 있음
- Aurora v3에서는 1과 2가 동일하게 동작하므로 변경 불필요

---

#### 3.1.4 innodb_purge_threads (Medium - 증가 권장)

| 항목 | IDC | Aurora 기본값 | 권장 |
|------|-----|---------------|------|
| 값 | 4 | 1 | **4** |

**Purge Thread 역할:**
- 삭제/업데이트된 행의 이전 버전 정리 (MVCC undo log)
- History List 정리
- 불필요한 undo log 제거

**r7g.8xlarge (32 vCPU) 환경에서:**
- CPU 여유 충분
- 4 스레드로 증가해도 부담 없음
- 쓰기 집약적 워크로드에서 효과적

**권장 설정:**
```
innodb_purge_threads = 4
```

---

#### 3.1.5 innodb_adaptive_hash_index (Medium - Aurora 기본값 유지)

| 항목 | IDC | Aurora 기본값 | 권장 |
|------|-----|---------------|------|
| 값 | ON | OFF | **OFF 유지** |

**Aurora에서 OFF인 이유:**
- **Reader 인스턴스에서 AHI 미지원** (AWS 문서 명시)
- Aurora의 분산 스토리지 아키텍처와 최적화 방식이 다름
- AHI 관련 mutex 경합이 고부하 환경에서 병목 가능

**결론:**
- Aurora **기본값(OFF) 유지**
- Aurora 아키텍처에서는 AHI 효과가 제한적

---

#### 3.1.6 innodb_strict_mode (Medium - Aurora 기본값 유지)

| 항목 | IDC | Aurora 기본값 | 권장 |
|------|-----|---------------|------|
| 값 | OFF | ON | **ON 유지** |

**분석:**
- `innodb_strict_mode = ON` 시: DDL 문에서 잠재적 문제 발생 시 에러로 처리
- `innodb_strict_mode = OFF` 시: 잠재적 문제를 경고로 처리하고 진행

**권장:**
- Aurora **기본값(ON) 유지** - 데이터 무결성 측면에서 안전
- 기존 DDL이 실패하는 경우에만 OFF 검토

---

### 3.2 Aurora 전용 파라미터

#### 3.2.1 aurora_oom_response (최우선)

**목적:** Out-of-Memory로 인한 DB 재시작 방지

**권장 설정:**
```
aurora_oom_response = 'print,tune,decline,kill_query,kill_connect,tune_buffer_pool'
```

**옵션 설명:**

| 옵션 | 동작 | 256GB 환경 효과 |
|------|------|-----------------|
| print | 메모리 소비 쿼리 로깅 | 문제 진단용 |
| tune | 테이블 캐시 자동 조정 | 메모리 여유 시 자동 복구 |
| decline | 새 쿼리 거부 | 연쇄 장애 방지 |
| kill_query | 고메모리 쿼리 종료 | 긴급 상황 대응 |
| kill_connect | 고메모리 연결 종료 | v3 전용, 강력한 대응 |
| tune_buffer_pool | 버퍼풀 자동 축소 | 256GB 환경에서 특히 유용 |

> ⚠️ **중요:** `tune_buffer_pool`은 **반드시** `kill_query` 또는 `kill_connect`와 함께 사용해야 합니다. 단독 사용 시 버퍼풀 리사이징이 동작하지 않습니다. (Aurora MySQL 3.06+ 지원)

**참고:** Aurora MySQL 3.09+에서 4GiB 초과 인스턴스 기본값이 `print,decline,kill_connect`이나, `tune`과 `tune_buffer_pool`은 기본 미포함이므로 명시적 추가 필요

---

#### 3.2.2 aurora_parallel_query

**목적:** 대용량 데이터 스캔 쿼리 성능 향상

> ⚠️ **필수 전제조건:** Parallel Query를 활성화하려면 **Hash Join이 활성화**되어 있어야 합니다.
> ```
> aurora_disable_hash_join = OFF   # 반드시 OFF (기본값)
> aurora_parallel_query = ON
> ```

**활성화 권장 상황:**
- 대용량 테이블 풀스캔 (수백만~수억 행)
- GROUP BY, SUM, COUNT 집계 쿼리
- 읽기 전용 리포팅/분석 쿼리
- 파티션 테이블 스캔

**비활성화 권장 상황:**
- 순수 OLTP (단순 CRUD)
- 인덱스 기반 단건 조회
- 짧은 트랜잭션 위주

**테스트 방법:**
```sql
-- Hash Join 활성화 확인
SHOW VARIABLES LIKE 'aurora_disable_hash_join';
-- 결과: OFF 여야 함

-- 세션에서 먼저 테스트
SET SESSION aurora_parallel_query = ON;

-- 쿼리 실행 후 확인
EXPLAIN SELECT ...;
-- Extra 컬럼에 "Using parallel query" 확인
```

---

#### 3.2.3 aurora_jemalloc_background_thread

**목적:** 메모리 단편화 완화 및 효율적 메모리 관리

**256GB 메모리 환경 효과:**
- 대용량 메모리에서 메모리 단편화 문제 완화
- 백그라운드에서 메모리 정리
- 장시간 운영 시 메모리 효율성 향상

**권장 설정:**
```
aurora_jemalloc_background_thread = 1
```

---

#### 3.2.4 aurora_jemalloc_dirty_decay_ms

**목적:** 해제된 메모리 유지 시간 조정

**튜닝 가이드:**

| 상황 | 권장값 | 이유 |
|------|--------|------|
| 일반 운영 | 10000 (기본값) | 메모리 재사용 효율성 유지 |
| Burst 워크로드 | 5000~7000 | 빠른 메모리 반환 |
| OOM 빈발 | 2000~5000 | 해제 메모리 즉시 반환 |
| 안정적 워크로드 | 15000~20000 | 메모리 재사용 최적화 |

---

#### 3.2.5 aurora_in_memory_relaylog (3.10 신기능)

**목적:** Binlog 복제 처리량 향상 (최대 40%)

**3.10+ 특화:**
- In-memory relay log 캐시 지원 확장
- 멀티스레드 복제 + replica_preserve_commit_order = ON 환경 지원

**설정 (Binlog 복제 사용 시):**
```
aurora_in_memory_relaylog = ON
```

---

#### 3.2.6 aurora_binlog_replication_sec_index_parallel_workers

**목적:** Binlog 복제 시 Secondary Index 변경 병렬 처리

**r7g.8xlarge (32 vCPU) 환경:**
- Secondary Index가 많은 대용량 테이블 복제 시 유용
- 32 vCPU 활용 → 병렬 워커 수 증가 가능

**설정 (Binlog 복제 시):**
```
aurora_binlog_replication_sec_index_parallel_workers = 8
```

---

#### 3.2.7 aurora_read_replica_read_committed

**목적:** Reader에서 장시간 분석 쿼리 실행 시 Purge Lag 방지

**활용 상황:**
- History List Length 급증 시
- 장시간 분석 쿼리 실행 시
- Purge Lag 문제 발생 시

**주의:** Non-repeatable read, Phantom read 발생 가능 - 정밀도보다 성능이 중요한 분석 쿼리에만 사용

**설정 (Reader 세션에서):**
```sql
SET SESSION aurora_read_replica_read_committed = ON;
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

---

### 3.3 추가 권장 파라미터

#### 3.3.1 성능 분석 및 트러블슈팅

| 파라미터 | 권장값 | 설명 |
|----------|--------|------|
| performance_schema | ON | 메모리/쿼리 분석 필수 (v3 기본 ON) |
| slow_query_log | ON | 느린 쿼리 로깅 |
| long_query_time | 1 | 1초 이상 쿼리 기록 |
| log_queries_not_using_indexes | ON | 인덱스 미사용 쿼리 기록 |
| innodb_print_all_deadlocks | ON | Deadlock 상세 로깅 |

**권장 설정:**
```
performance_schema = ON
slow_query_log = ON
long_query_time = 1
log_queries_not_using_indexes = ON
innodb_print_all_deadlocks = ON
```

#### 3.3.2 연결 관리 (256GB 환경)

| 파라미터 | 기본값 | 권장값 | 설명 |
|----------|--------|--------|------|
| max_connections | ~5000 | 5000~10000 | 워크로드에 따라 조정 |
| wait_timeout | 28800 | 300~600 | 유휴 연결 정리 (5~10분) |
| interactive_timeout | 28800 | 300~600 | 대화형 연결 정리 |

> **주의:** `max_connections` 증가 시 메모리 사용량도 증가합니다. 연결당 약 1~10MB 추가 메모리 필요.

#### 3.3.3 Binlog 복제 사용 시 추가 설정

```
# Binlog 복제 최적화
binlog_format = ROW                              # STATEMENT 대신 ROW 권장
binlog_row_image = MINIMAL                       # 네트워크 트래픽 감소
replica_preserve_commit_order = ON               # aurora_in_memory_relaylog와 함께
log_bin_trust_function_creators = ON             # 함수 생성 허용 (복제 환경)
sync_binlog = 1                                  # 기본값 유지 권장
```

---

## 4. Parameter Group 설정 정리

### 4.1 DB Cluster Parameter Group

```
# ============================================
# IDC 호환성
# ============================================
transaction_isolation = READ-COMMITTED
innodb_purge_threads = 4

# ============================================
# Aurora OOM 방지 (최우선)
# ============================================
aurora_oom_response = 'print,tune,decline,kill_query,kill_connect,tune_buffer_pool'

# ============================================
# Aurora 성능 최적화
# ============================================
aurora_disable_hash_join = OFF                   # Parallel Query 전제조건
aurora_parallel_query = ON                       # OLAP 워크로드 시
aurora_jemalloc_background_thread = 1

# ============================================
# 성능 분석 및 트러블슈팅
# ============================================
slow_query_log = ON
long_query_time = 1
innodb_print_all_deadlocks = ON

# ============================================
# Binlog 복제 사용 시 (해당되는 경우만)
# ============================================
# binlog_format = ROW
# binlog_row_image = MINIMAL
# aurora_in_memory_relaylog = ON
# aurora_binlog_replication_sec_index_parallel_workers = 8
# replica_preserve_commit_order = ON
# log_bin_trust_function_creators = ON
```

### 4.2 DB Parameter Group (Instance Level)

```
# IDC 호환성
sql_mode = NO_ENGINE_SUBSTITUTION

# 연결 관리 (필요 시 조정)
# max_connections = 8000
# wait_timeout = 600
# interactive_timeout = 600
```

---

## 5. 적용 순서

| 순서 | 파라미터 | 재시작 | 설명 |
|------|----------|--------|------|
| 1 | transaction_isolation | 불필요 | IDC 호환성 - 최우선 |
| 2 | sql_mode | 불필요 | IDC 호환성 |
| 3 | aurora_oom_response | 불필요 | 안전성 강화 |
| 4 | aurora_disable_hash_join | 불필요 | Parallel Query 전제조건 확인 |
| 5 | aurora_parallel_query | 불필요 | 테스트 후 적용 |
| 6 | slow_query_log, long_query_time | 불필요 | 성능 분석 활성화 |
| 7 | innodb_purge_threads | **필요** | 성능 향상 |
| 8 | aurora_jemalloc_background_thread | **필요** | 메모리 최적화 |
| 9 | aurora_in_memory_relaylog | 불필요 | 복제 성능 (해당 시) |
| 10 | 기타 | 상황별 | 필요에 따라 |

> **재시작 전략:** 순서 1~6까지 적용 후 동작 확인 → 순서 7~8은 유지보수 윈도우에서 재시작과 함께 적용
