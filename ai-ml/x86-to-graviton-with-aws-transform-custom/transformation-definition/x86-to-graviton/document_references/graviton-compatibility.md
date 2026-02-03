# AWS Graviton 호환성 참조 문서

## Java 애플리케이션의 Graviton 호환성

### 높은 호환성의 이유

Java는 JVM(Java Virtual Machine) 위에서 실행되므로, 대부분의 순수 Java 코드는 **수정 없이** Graviton에서 실행됩니다.

```
Java 소스 코드 (.java)
       ↓
  바이트코드 (.class)
       ↓
   JVM (플랫폼별)
       ↓
  x86 또는 ARM64
```

### ARM64 지원 JDK 배포판

| 배포판 | ARM64 지원 | 다운로드 |
|--------|-----------|----------|
| Amazon Corretto | ✅ | https://aws.amazon.com/corretto |
| Eclipse Temurin | ✅ | https://adoptium.net |
| Oracle JDK | ✅ | https://www.oracle.com/java |
| Azul Zulu | ✅ | https://www.azul.com/downloads |
| GraalVM | ✅ | https://www.graalvm.org |

### 지원 Java 버전

| Java 버전 | ARM64 지원 | 권장 |
|-----------|-----------|------|
| Java 8 | ✅ | 11+ 권장 |
| Java 11 (LTS) | ✅ | 권장 |
| Java 17 (LTS) | ✅ | 권장 |
| Java 21 (LTS) | ✅ | 권장 |

## 호환성 주의 영역

### 1. JNI (Java Native Interface)

네이티브 코드를 사용하는 라이브러리는 ARM64용 바이너리가 필요합니다.

**확인 방법**:
```bash
# JAR 파일 내 네이티브 라이브러리 확인
unzip -l myapp.jar | grep -E '\.(so|dll|dylib)$'
```

**해결 방법**:
- ARM64 지원 버전으로 업그레이드
- 순수 Java 대체 라이브러리 사용
- 직접 ARM64용 네이티브 라이브러리 빌드

### 2. x86 전용 JVM 옵션

일부 JVM 옵션은 x86 프로세서에서만 유효합니다.

**x86 전용 옵션**:
```
-XX:+UseAVX
-XX:+UseAVX2
-XX:+UseAVX512
-XX:+UseSHA (x86 가속)
-XX:UseSSE=N
```

**ARM64 호환 옵션**:
```
-XX:+UseG1GC
-XX:+UseContainerSupport
-XX:+UseNUMA
-XX:MaxRAMPercentage=75.0
```

### 3. 빌드 도구

Maven과 Gradle은 플랫폼 독립적이므로 대부분 수정 없이 작동합니다.

**주의점**:
- 네이티브 의존성을 포함하는 플러그인
- 아키텍처별 classifier를 사용하는 의존성

## 성능 특성

### Graviton 성능 이점

| 워크로드 | x86 대비 성능 |
|----------|---------------|
| 웹 서버 | 최대 40% 처리량 향상 |
| 마이크로서비스 | 최대 30% 응답 시간 개선 |
| Java 애플리케이션 | JIT 최적화로 성능 향상 |
| 암호화 작업 | ARM 암호화 가속 활용 |

### JIT 컴파일러 최적화

Graviton은 대형 L2 캐시와 높은 메모리 대역폭을 제공하여 JIT 컴파일된 코드가 효율적으로 실행됩니다.

```
권장 JVM 플래그:
-XX:+UseG1GC
-XX:+UseNUMA
-XX:+AlwaysPreTouch
```

## 마이그레이션 접근 방식

### 1. Lift and Shift (대부분의 경우)

대부분의 Java 애플리케이션은 재컴파일 없이 Graviton에서 실행 가능합니다.

```
기존 JAR/WAR → Graviton JVM에서 실행
```

### 2. 재빌드 (필요 시)

네이티브 의존성이 있는 경우 ARM64 환경에서 재빌드합니다.

### 3. 컨테이너 활용

Multi-architecture Docker 이미지로 두 아키텍처를 동시 지원합니다.

```dockerfile
FROM --platform=$TARGETPLATFORM eclipse-temurin:17-jre
```
