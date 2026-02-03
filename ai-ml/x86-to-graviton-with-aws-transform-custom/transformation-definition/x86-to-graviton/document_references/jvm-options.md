# JVM 옵션 참조 문서

이 문서는 x86에서 Graviton(ARM64)으로 전환 시 JVM 옵션 변환 가이드를 제공합니다.

## x86 전용 옵션 (제거 필요)

다음 옵션은 x86 프로세서에서만 유효하며, ARM64에서는 인식되지 않거나 오류를 발생시킵니다.

### AVX (Advanced Vector Extensions)

| 옵션 | 설명 | 조치 |
|------|------|------|
| `-XX:+UseAVX` | AVX 명령어셋 활성화 | 제거 |
| `-XX:+UseAVX2` | AVX2 명령어셋 활성화 | 제거 |
| `-XX:+UseAVX512` | AVX-512 명령어셋 활성화 | 제거 |

**오류 예시**:
```
Unrecognized VM option 'UseAVX'
Error: Could not create the Java Virtual Machine.
```

### SSE (Streaming SIMD Extensions)

| 옵션 | 설명 | 조치 |
|------|------|------|
| `-XX:UseSSE=N` | SSE 레벨 지정 (0-4) | 제거 |
| `-XX:+UseSSE42` | SSE 4.2 활성화 | 제거 |

### SHA/AES 가속

| 옵션 | 설명 | 조치 |
|------|------|------|
| `-XX:+UseSHA` | x86 SHA 하드웨어 가속 | 제거 |
| `-XX:+UseAES` | x86 AES 하드웨어 가속 | 제거 |
| `-XX:+UseAESIntrinsics` | AES 내장 함수 | 제거 |

> **참고**: ARM64에서는 해당 암호화 가속이 자동으로 활성화됩니다.

## Graviton 권장 옵션

### 필수 권장 옵션

```bash
JAVA_OPTS="-XX:+UseG1GC -XX:+UseContainerSupport"
```

| 옵션 | 설명 | 권장 이유 |
|------|------|-----------|
| `-XX:+UseG1GC` | G1 가비지 컬렉터 | Graviton에 최적화 |
| `-XX:+UseContainerSupport` | 컨테이너 리소스 인식 | 컨테이너 환경 필수 |

### 추가 권장 옵션

```bash
JAVA_OPTS="-XX:+UseG1GC \
  -XX:+UseContainerSupport \
  -XX:+UseNUMA \
  -XX:+AlwaysPreTouch \
  -XX:MaxRAMPercentage=75.0"
```

| 옵션 | 설명 | 사용 시점 |
|------|------|-----------|
| `-XX:+UseNUMA` | NUMA 아키텍처 최적화 | 멀티 소켓 Graviton |
| `-XX:+AlwaysPreTouch` | 메모리 사전 할당 | 대용량 힙 사용 시 |
| `-XX:MaxRAMPercentage=75.0` | 컨테이너 메모리 75% 사용 | 컨테이너 환경 |
| `-XX:InitialRAMPercentage=50.0` | 초기 힙 크기 | 빠른 시작 필요 시 |
| `-XX:+UseTransparentHugePages` | 대용량 페이지 | TLB 미스 감소 |

### 컨테이너 환경 전용

```bash
# Docker/Kubernetes 환경
JAVA_OPTS="-XX:+UseContainerSupport \
  -XX:MaxRAMPercentage=75.0 \
  -XX:InitialRAMPercentage=50.0"
```

## 변환 예시

### Dockerfile

**Before (x86 전용)**:
```dockerfile
ENV JAVA_OPTS="-Xmx2g \
  -XX:+UseG1GC \
  -XX:+UseAVX2 \
  -XX:+UseSHA"

ENTRYPOINT ["java", "-XX:+UseAVX", "-jar", "app.jar"]
```

**After (ARM64 호환)**:
```dockerfile
ENV JAVA_OPTS="-Xmx2g \
  -XX:+UseG1GC \
  -XX:+UseContainerSupport \
  -XX:MaxRAMPercentage=75.0"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```

### Shell 스크립트

**Before**:
```bash
#!/bin/bash
java -Xmx4g \
  -XX:+UseG1GC \
  -XX:+UseAVX2 \
  -XX:UseSSE=4 \
  -jar myapp.jar
```

**After**:
```bash
#!/bin/bash
java -Xmx4g \
  -XX:+UseG1GC \
  -XX:+UseNUMA \
  -XX:+AlwaysPreTouch \
  -jar myapp.jar
```

### application.properties / application.yml

**Before**:
```yaml
# application.yml
server:
  tomcat:
    # JVM args가 여기 없음 - 외부에서 설정됨
```

일반적으로 JVM 옵션은 `application.yml`이 아닌 시작 스크립트나 Dockerfile에서 설정됩니다.

## GC 선택 가이드

### Graviton에서의 GC 권장사항

| GC | 권장 | 사용 사례 |
|----|------|-----------|
| G1GC | ✅ 권장 | 범용, 대부분의 워크로드 |
| ZGC | ✅ 권장 | 초저지연 필요 시 (Java 15+) |
| Shenandoah | ✅ 사용 가능 | 낮은 지연 시간 |
| ParallelGC | 사용 가능 | 처리량 중심 |
| SerialGC | 비권장 | 싱글 코어용 |

### G1GC 튜닝 옵션

```bash
-XX:+UseG1GC \
-XX:MaxGCPauseMillis=200 \
-XX:G1HeapRegionSize=16m \
-XX:+G1UseAdaptiveIHOP
```

### ZGC (Java 15+)

```bash
-XX:+UseZGC \
-XX:+ZGenerational \  # Java 21+
-XX:SoftMaxHeapSize=4g
```

## 검증 방법

### 현재 JVM 옵션 확인

```bash
# 실행 중인 Java 프로세스의 옵션 확인
jcmd <pid> VM.flags

# 또는
ps aux | grep java
```

### JVM 옵션 호환성 테스트

```bash
# ARM64 환경에서 옵션 테스트
java -XX:+PrintFlagsFinal -version 2>&1 | grep -E "(AVX|SSE|SHA|AES)"
```

### 시작 시 옵션 출력

```bash
java -XshowSettings:vm -version
```

## 문제 해결

### "Unrecognized VM option" 오류

```
Error: Unrecognized VM option 'UseAVX'
```

**해결**: x86 전용 옵션 제거

### OutOfMemoryError (컨테이너)

```
java.lang.OutOfMemoryError: Java heap space
```

**해결**: 컨테이너 메모리 설정 추가
```bash
-XX:+UseContainerSupport \
-XX:MaxRAMPercentage=75.0
```

### 성능 저하

**확인**: GC 로그 분석
```bash
-Xlog:gc*:file=gc.log:time,tags
```

**해결**: Graviton 최적화 옵션 추가
```bash
-XX:+UseNUMA \
-XX:+AlwaysPreTouch
```
