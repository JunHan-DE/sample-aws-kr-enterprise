# 04. 변환 실행

이 문서에서는 AWS Transform Custom의 `atx` CLI를 사용하여 x86 Java 애플리케이션을 Graviton(ARM64)으로 변환하는 방법을 안내합니다.

## 변환 워크플로우

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Prepare    │ →  │   Execute   │ →  │   Review    │ →  │   Deploy    │
│  준비       │    │   실행      │    │   검토      │    │   배포      │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## Step 1: 사전 준비

### 필수 조건

1. **Git 저장소**: atx CLI는 Git 저장소에서만 동작합니다.
2. **AWS 자격 증명**: AWS CLI 또는 환경 변수로 설정
3. **atx CLI 설치**: `atx --version`으로 확인

### 대상 프로젝트 준비

```bash
cd your-java-project

# Git 초기화 (이미 Git 저장소면 생략)
git init
git add -A
git commit -m "Initial commit before transformation"
```

### 사용 가능한 Transformation 확인

```bash
atx custom def list
```

**x86→Graviton 변환용 Transformation**:
```
AWS/early-access-java-x86-to-graviton
```

## Step 2: 변환 실행

### 대화형 실행 (권장)

```bash
atx custom def exec \
  -p . \
  -n "AWS/early-access-java-x86-to-graviton" \
  -c "mvn clean package -DskipTests"
```

대화형 모드에서는:
- 변환 계획 확인 및 조정 가능
- 각 단계 진행 전 확인 요청
- 필요시 추가 컨텍스트 제공 가능

### 비대화형 실행 (자동화용)

```bash
atx custom def exec \
  -p . \
  -n "AWS/early-access-java-x86-to-graviton" \
  -c "mvn clean package -DskipTests" \
  -x -t
```

### 옵션 상세 설명

| 옵션 | 전체 옵션 | 설명 | 필수 |
|------|----------|------|------|
| `-p` | `--code-repository-path` | 변환 대상 코드 경로 | ✅ |
| `-n` | `--transformation-name` | Transformation Definition 이름 | ✅ |
| `-c` | `--build-command` | 빌드 명령어 | ✅ |
| `-x` | `--non-interactive` | 비대화형 모드 | ❌ |
| `-t` | `--trust-all-tools` | 모든 도구 자동 승인 | ❌ |
| `-d` | `--do-not-learn` | 지식 추출 비활성화 | ❌ |
| `-g` | `--configuration` | 추가 설정 (JSON/YAML) | ❌ |
| `--tv` | `--transformation-version` | 특정 버전 사용 | ❌ |

### 추가 컨텍스트 제공

```bash
# 설정 파일 사용
atx custom def exec \
  -p . \
  -n "AWS/early-access-java-x86-to-graviton" \
  -c "mvn clean package -DskipTests" \
  -g "file://config.json"

# 인라인 설정
atx custom def exec \
  -p . \
  -n "AWS/early-access-java-x86-to-graviton" \
  -c "mvn clean package -DskipTests" \
  -g "additionalPlanContext=Focus on Dockerfile JVM optimization"
```

## Step 3: 변환 과정

실행하면 8단계의 자동화된 변환 프로세스가 진행됩니다:

| Step | 단계명 | 주요 작업 |
|------|--------|-----------|
| 1 | Static Compatibility Analysis | 정적 분석 및 프로젝트 평가 |
| 2 | Dependency ARM64 Validation | 의존성 호환성 검증 |
| 3 | JVM Optimizations | Graviton 최적화 JVM 플래그 적용 |
| 4 | Maven ARM64 Profile | ARM64 빌드 프로필 추가 |
| 5 | Build Validation | ARM64 빌드 검증 스크립트 생성 |
| 6 | Functional Testing | 기능 테스트 문서화 |
| 7 | Performance Validation | 성능/안정성 검증 스크립트 생성 |
| 8 | CI/CD and Documentation | Multi-arch CI/CD 가이드 |

각 단계 완료 시 Git 커밋이 자동 생성됩니다.

## Step 4: 결과 확인

### 생성되는 파일들

변환 완료 후 프로젝트에 다음 파일들이 생성됩니다:

```
your-project/
├── ARM64-COMPATIBILITY-REPORT.md    # 최종 호환성 보고서
├── README.md                        # 배포 가이드 (업데이트됨)
├── CI-CD-INTEGRATION-GUIDE.md       # CI/CD 통합 가이드
├── Dockerfile                       # Graviton 최적화 적용 (수정됨)
├── pom.xml                          # ARM64 프로필 추가 (수정됨)
├── docker-compose.yml               # Multi-arch 지원 (수정됨)
├── validate-arm64-build.sh          # 빌드 검증 스크립트
├── test-arm64-functional.sh         # 기능 테스트 스크립트
├── test-arm64-performance.sh        # 성능 테스트 스크립트
└── arm64-*.md                       # 단계별 분석 문서
```

### Git 히스토리 확인

```bash
git log --oneline
```

**예상 출력**:
```
35663bb Step 8: Multi-Architecture CI/CD and Documentation
c248d2e Step 7: Performance and Stability Validation on ARM64
cffb90d Step 6: Functional Testing on ARM64 Architecture
42873a4 Step 5: ARM64 Build Validation and Container Image Testing
3e53063 Step 4: Add ARM64 Build Profile and Configuration to Maven
ef11365 Step 3: Enhance Graviton-Specific JVM Optimizations in Dockerfile
42f1354 Step 2: Dependency ARM64 Compatibility Validation
d3e0dc5 Step 1: Static Compatibility Analysis and Project Assessment
```

### 호환성 보고서 확인

```bash
cat ARM64-COMPATIBILITY-REPORT.md
```

보고서에는 다음 내용이 포함됩니다:
- Executive Summary
- 의존성 호환성 매트릭스
- 네이티브 라이브러리 분석 결과
- 적용된 JVM 최적화
- 테스트 결과 요약
- 배포 가이드

## 변환 결과 검증

### 1. 빌드 검증 스크립트 실행

```bash
chmod +x validate-arm64-build.sh
./validate-arm64-build.sh
```

### 2. Docker 이미지 빌드

```bash
# ARM64 이미지 빌드
docker buildx build --platform linux/arm64 -t myapp:arm64 --load .

# 아키텍처 확인
docker inspect myapp:arm64 --format '{{.Architecture}}'
# 예상: arm64
```

### 3. 애플리케이션 실행 테스트

```bash
# 컨테이너 실행
docker run -d -p 8080:8080 --name test-app myapp:arm64

# 헬스 체크
curl http://localhost:8080/actuator/health
# 예상: {"status":"UP"}

# 아키텍처 확인
curl http://localhost:8080/api/system-info
# 예상: {"osArch":"aarch64","architectureType":"ARM64 (Graviton)"}

# 정리
docker stop test-app && docker rm test-app
```

### 4. 기능/성능 테스트

```bash
chmod +x test-arm64-functional.sh test-arm64-performance.sh

./test-arm64-functional.sh
./test-arm64-performance.sh
```

## 로그 확인

### 실행 로그 위치

```bash
# 변환 로그
ls ~/.aws/atx/custom/<conversation_id>/logs/

# 디버그 로그
ls ~/.aws/atx/logs/
```

## 문제 해결

### Git 저장소 오류

```bash
# 오류: "must be managed by git for atx to operate"
git init && git add -A && git commit -m "Initial commit"
```

### 빌드 명령어 오류

```bash
# Gradle 프로젝트의 경우
atx custom def exec \
  -p . \
  -n "AWS/early-access-java-x86-to-graviton" \
  -c "./gradlew clean build -x test"
```

### 변환 중단 후 재시작

변환이 중단된 경우 Git 상태를 확인하고 다시 실행합니다:

```bash
# 변경사항 확인
git status

# 변환 재실행
atx custom def exec -p . -n "AWS/early-access-java-x86-to-graviton" -c "mvn clean package -DskipTests"
```

## 다음 단계

[05. 검증 및 트러블슈팅](05-validation-guide.md)에서 변환 결과 검증 방법과 일반적인 문제 해결 방법을 확인하세요.
