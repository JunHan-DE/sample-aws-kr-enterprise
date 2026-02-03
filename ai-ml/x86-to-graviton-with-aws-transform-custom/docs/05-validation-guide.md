# 05. 검증 및 트러블슈팅

이 문서에서는 Transform Custom으로 변환된 코드의 검증 방법과 일반적인 문제 해결 방법을 안내합니다.

## 검증 체크리스트

### 변환 후 필수 검증 항목

| # | 검증 항목 | 명령어 | 예상 결과 |
|---|----------|--------|-----------|
| 1 | Git 커밋 확인 | `git log --oneline` | 8개 커밋 |
| 2 | 호환성 보고서 | `cat ARM64-COMPATIBILITY-REPORT.md` | 보고서 확인 |
| 3 | 빌드 성공 | `mvn clean package` | BUILD SUCCESS |
| 4 | 테스트 통과 | `mvn test` | Tests: X, Failures: 0 |
| 5 | Docker ARM64 빌드 | `docker buildx build --platform linux/arm64` | Successfully built |
| 6 | 헬스 체크 | `curl /actuator/health` | {"status":"UP"} |
| 7 | 아키텍처 확인 | `curl /api/system-info` | aarch64 |

## 자동 생성된 검증 스크립트 사용

Transform Custom 실행 후 자동 생성되는 검증 스크립트를 활용하세요:

```bash
# 빌드 검증
chmod +x validate-arm64-build.sh
./validate-arm64-build.sh

# 기능 테스트 (Docker 컨테이너 실행 중일 때)
chmod +x test-arm64-functional.sh
./test-arm64-functional.sh

# 성능 테스트
chmod +x test-arm64-performance.sh
./test-arm64-performance.sh
```

## 단계별 검증

### 1. 변환 결과 확인

```bash
# Git 커밋 히스토리 확인
git log --oneline

# 예상 출력 (8개 커밋):
# 35663bb Step 8: Multi-Architecture CI/CD and Documentation
# c248d2e Step 7: Performance and Stability Validation on ARM64
# cffb90d Step 6: Functional Testing on ARM64 Architecture
# ...
```

### 2. 빌드 검증

```bash
# Maven 빌드
mvn clean package -DskipTests

# 빌드 성공 확인
echo $?  # 0이면 성공
```

**빌드 실패 시 확인사항**:
- 의존성 버전 호환성
- Java 버전 일치 여부
- 구문 오류

### 3. 테스트 검증

```bash
# 단위 테스트 실행
mvn test

# 테스트 리포트 확인
cat target/surefire-reports/*.txt
```

### 4. Docker 빌드 검증

```bash
# ARM64 전용 빌드
docker buildx build \
  --platform linux/arm64 \
  -t myapp:arm64-test \
  --load \
  .

# 이미지 아키텍처 확인
docker inspect myapp:arm64-test --format '{{.Architecture}}'
# 예상: arm64
```

### 5. 런타임 검증

```bash
# 컨테이너 실행
docker run -d -p 8080:8080 --name test-app myapp:arm64-test

# 시작 대기
sleep 15

# 헬스 체크
curl http://localhost:8080/actuator/health
# 예상: {"status":"UP"}

# 아키텍처 정보 확인
curl http://localhost:8080/api/system-info
# 예상: {"osArch":"aarch64","architectureType":"ARM64 (Graviton)"}

# 정리
docker stop test-app && docker rm test-app
```

### 6. 성능 검증

```bash
# 벤치마크 실행 (x86 vs ARM64 비교)
curl "http://x86-host:8080/api/compute/benchmark?iterations=100000"
curl "http://arm64-host:8080/api/compute/benchmark?iterations=100000"
```

## 일반적인 문제 및 해결

### 문제 1: Git 저장소 오류

**증상**:
```
Fatal error: each package being transformed must be managed by git for atx to operate
```

**원인**: 대상 디렉토리가 Git 저장소가 아님

**해결**:
```bash
git init
git add -A
git commit -m "Initial commit"
```

### 문제 2: JVM 옵션 오류

**증상**:
```
Error: Unrecognized VM option 'UseAVX'
Error: Could not create the Java Virtual Machine.
```

**원인**: x86 전용 JVM 옵션이 남아있음

**해결**:
```bash
# Dockerfile에서 x86 옵션 확인
grep -E "(UseAVX|UseSSE|UseSHA)" Dockerfile

# 제거 후 재빌드
docker build --no-cache .
```

### 문제 3: 네이티브 라이브러리 로드 실패

**증상**:
```
java.lang.UnsatisfiedLinkError: no native library in java.library.path
```

**원인**: ARM64용 네이티브 라이브러리 없음

**해결**:
```xml
<!-- pom.xml에서 버전 업그레이드 -->
<dependency>
    <groupId>org.xerial.snappy</groupId>
    <artifactId>snappy-java</artifactId>
    <version>1.1.10.5</version> <!-- ARM64 지원 버전 -->
</dependency>
```

### 문제 4: Docker 빌드 플랫폼 오류

**증상**:
```
ERROR: Multi-platform build is not supported
```

**원인**: Docker buildx 미설정

**해결**:
```bash
# buildx 빌더 생성
docker buildx create --name multiarch --driver docker-container --use
docker buildx inspect --bootstrap

# 다시 빌드
docker buildx build --platform linux/arm64 -t myapp:arm64 .
```

### 문제 5: 메모리 부족 (컨테이너)

**증상**:
```
java.lang.OutOfMemoryError: Java heap space
```

**원인**: 컨테이너 메모리 인식 안됨

**해결**:
```dockerfile
# Dockerfile에 추가 (Transform Custom이 자동 적용)
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
```

### 문제 6: 성능 저하

**증상**: Graviton에서 예상보다 낮은 성능

**진단**:
```bash
# GC 로그 확인
java -Xlog:gc* -jar app.jar

# JVM 플래그 확인
jcmd <pid> VM.flags
```

**해결** (Transform Custom이 자동 적용하는 플래그):
```bash
JAVA_OPTS="-XX:+UseG1GC -XX:-TieredCompilation -XX:CICompilerCount=2"
```

## 롤백 절차

변환 결과에 문제가 있는 경우:

### Git을 사용한 롤백

```bash
# 변환 전 상태로 롤백 (8개 커밋 전)
git reset --hard HEAD~8

# 또는 특정 커밋으로
git checkout <initial-commit-hash> -- .
```

### 특정 단계로 롤백

```bash
# Step 3까지만 적용하고 나머지 롤백
git reset --hard <step-3-commit-hash>
```

## 호환성 보고서 검토

Transform Custom이 생성한 `ARM64-COMPATIBILITY-REPORT.md`를 검토하세요:

```bash
cat ARM64-COMPATIBILITY-REPORT.md
```

보고서에서 확인할 항목:
- **Executive Summary**: 전체 호환성 상태
- **Dependency Compatibility Matrix**: 의존성별 호환성
- **Native Library Analysis**: 네이티브 라이브러리 분석 결과
- **JVM Optimizations**: 적용된 Graviton 최적화
- **Test Results**: 테스트 결과 요약

## 로그 확인

### ATX CLI 로그 위치

```bash
# 변환 세션 로그
ls ~/.aws/atx/custom/<conversation_id>/logs/

# 아티팩트 (계획, 워크로그 등)
ls ~/.aws/atx/custom/<conversation_id>/artifacts/

# 전역 디버그 로그
ls ~/.aws/atx/logs/
```

## 완료 후 다음 단계

검증이 완료되면:

1. **프로덕션 배포 준비**
   - Multi-arch 이미지를 ECR에 푸시
   - Graviton 인스턴스에 배포

2. **점진적 전환**
   - Canary 배포로 일부 트래픽 전환
   - 모니터링 및 성능 비교
   - 문제 없으면 전체 전환

3. **비용 절감 확인**
   - CloudWatch에서 비용 비교
   - 성능 대비 비용 효율성 검증

## CI/CD 통합

변환 완료 후 생성된 `CI-CD-INTEGRATION-GUIDE.md`를 참조하여 파이프라인에 통합하세요:

```bash
cat CI-CD-INTEGRATION-GUIDE.md
```

지원 플랫폼:
- GitHub Actions
- AWS CodeBuild
- AWS CodePipeline
- GitLab CI/CD
- Jenkins
- CircleCI
