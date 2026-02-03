# Reference Document Summaries

이 문서는 x86→Graviton 변환에 사용되는 참조 문서들의 요약입니다.

## 1. AWS Graviton 호환성 가이드

### 핵심 내용

- **Java 호환성**: Java는 JVM 위에서 실행되므로 대부분의 순수 Java 코드는 수정 없이 Graviton에서 실행됨
- **JDK 지원**: Amazon Corretto, Eclipse Temurin, Oracle JDK 등 주요 JDK 배포판이 ARM64 지원
- **성능**: 많은 워크로드에서 동일 가격대 대비 더 높은 성능 제공

### 주의 영역

| 영역 | 설명 | 해결 방법 |
|------|------|-----------|
| JNI 라이브러리 | 네이티브 코드는 아키텍처별 바이너리 필요 | ARM64용 라이브러리 확인/교체 |
| 네이티브 의존성 | RocksDB, LevelDB 등 | ARM64 지원 버전 사용 |
| JVM 옵션 | 일부 x86 전용 옵션 | JVM 옵션 검토 및 조정 |

## 2. 네이티브 라이브러리 매핑

### 압축 라이브러리

| 라이브러리 | ARM64 최소 버전 | 권장 버전 | 비고 |
|------------|-----------------|-----------|------|
| snappy-java | 1.1.8.0 | 1.1.10.5 | 1.1.8.0부터 ARM64 지원 |
| lz4-java | 1.8.0 | 1.8.0 | ARM64 native 지원 |
| zstd-jni | 1.5.0-1 | 1.5.5-6 | ARM64 최적화 포함 |

### 데이터베이스 드라이버

| 라이브러리 | ARM64 최소 버전 | 권장 버전 | 비고 |
|------------|-----------------|-----------|------|
| rocksdbjni | 6.22.1 | 7.10.2 | 7.x 권장 |
| sqlite-jdbc | 3.36.0 | 3.44.1.0 | 3.36.0부터 ARM64 지원 |
| leveldbjni | N/A | - | ARM64 미지원, leveldb-java로 대체 |

### SSL/TLS 라이브러리

| 라이브러리 | ARM64 최소 버전 | 권장 버전 | 비고 |
|------------|-----------------|-----------|------|
| netty-tcnative-boringssl-static | 2.0.61.Final | 2.0.61.Final | ARM64 BoringSSL 바이너리 포함 |
| conscrypt-openjdk | 2.5.2 | 2.5.2 | Google의 OpenSSL 기반 |

## 3. JVM 옵션 가이드

### x86 전용 옵션 (제거 필요)

| 옵션 | 설명 | 조치 |
|------|------|------|
| `-XX:+UseAVX` | AVX 명령어셋 | 제거 |
| `-XX:+UseAVX2` | AVX2 명령어셋 | 제거 |
| `-XX:+UseAVX512` | AVX-512 명령어셋 | 제거 |
| `-XX:+UseSHA` | x86 SHA 가속 | 제거 (ARM64는 자동) |
| `-XX:UseSSE=N` | SSE 명령어셋 | 제거 |

### Graviton 권장 옵션

| 옵션 | 설명 | 우선순위 |
|------|------|----------|
| `-XX:+UseG1GC` | Graviton 최적화 GC | 필수 |
| `-XX:+UseContainerSupport` | 컨테이너 메모리 인식 | 필수 (컨테이너 환경) |
| `-XX:+UseNUMA` | 멀티 소켓 최적화 | 권장 |
| `-XX:+AlwaysPreTouch` | 메모리 할당 지연 감소 | 선택 |
| `-XX:+UseTransparentHugePages` | TLB 미스 감소 | 선택 |

## 4. Docker Multi-Architecture 빌드

### 기본 접근 방식

1. **buildx 사용**: Docker buildx로 멀티 아키텍처 이미지 빌드
2. **플랫폼 변수 활용**: `$TARGETPLATFORM`, `$TARGETARCH` 등
3. **적절한 베이스 이미지**: 멀티 아키텍처 지원 베이스 이미지 사용

### 권장 베이스 이미지

| 용도 | 권장 이미지 |
|------|-------------|
| Java 런타임 | `eclipse-temurin:17-jre` |
| Java 개발 | `eclipse-temurin:17-jdk` |
| Amazon Corretto | `amazoncorretto:17` |

### 빌드 명령어

```bash
# buildx 빌더 생성
docker buildx create --name multiarch --use

# 멀티 아키텍처 빌드 및 푸시
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t myapp:latest \
  --push .
```

## 5. 비용 절감 효과

### 인스턴스 비교 (서울 리전 기준)

| x86 인스턴스 | Graviton 인스턴스 | 시간당 비용 절감 |
|--------------|------------------|-----------------|
| t3.medium | t4g.medium | ~19% |
| m5.large | m6g.large | ~20% |
| c5.xlarge | c6g.xlarge | ~20% |
| r5.large | r6g.large | ~20% |

### 추가 이점

- 에너지 효율성 60% 향상
- 동일 가격대 대비 성능 향상
- 탄소 발자국 감소
