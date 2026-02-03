# AWS Transform Custom (atx) CLI 명령어 가이드

이 문서에서는 AWS Transform Custom CLI (`atx`)의 주요 명령어와 사용 예제를 제공합니다.

> **중요**: AWS Transform Custom은 `aws transform` 명령어가 아닌 별도의 `atx` CLI를 사용합니다.

## CLI 정보

```bash
# 버전 확인
atx --version
# 출력: atx version 1.1.1

# 전체 도움말
atx --help
```

## 기본 명령어 구조

```
atx custom def <command> [options]
```

### 사용 가능한 명령어

| 명령어 | 설명 |
|--------|------|
| `exec` | Transformation 실행 |
| `list` | 사용 가능한 Transformation 목록 |
| `get` | Transformation 상세 정보 (사용자 정의만) |
| `publish` | Transformation 배포 |
| `save-draft` | 초안 저장 |

## Transformation 목록 조회

### 전체 목록

```bash
atx custom def list
```

**출력 예시**:
```
Found 8 transformations:
  - 8 AWS Managed transformations

🏢 AWS Managed Transformations:

┌──────────────────────────────────────────┬─────────────────────────────────────┬──────────────┐
│ Transformation Name                      │ Description                         │ Version      │
├──────────────────────────────────────────┼─────────────────────────────────────┼──────────────┤
│ 🏢 AWS/early-access-java-x86-to-graviton │ Validates Java application compati- │ 2025-11-19   │
│                                          │ bility with Arm64 architecture...   │              │
├──────────────────────────────────────────┼─────────────────────────────────────┼──────────────┤
│ 🏢 AWS/java-version-upgrade              │ Upgrade Java applications using any │ 2025-11-11   │
│                                          │ build system...                     │              │
├──────────────────────────────────────────┼─────────────────────────────────────┼──────────────┤
│ 🏢 AWS/java-aws-sdk-v1-to-v2             │ Upgrade the AWS SDK from V1 to V2   │ 2025-10-16   │
│                                          │ for Java projects...                │              │
├──────────────────────────────────────────┼─────────────────────────────────────┼──────────────┤
│ 🏢 AWS/python-version-upgrade            │ Migrate Python projects from 3.8/   │ 2025-10-01   │
│                                          │ 3.9 to Python 3.11/3.12/3.13...     │              │
├──────────────────────────────────────────┼─────────────────────────────────────┼──────────────┤
│ 🏢 AWS/nodejs-version-upgrade            │ Upgrade NodeJS applications...      │ 2025-11-04   │
└──────────────────────────────────────────┴─────────────────────────────────────┴──────────────┘
```

## Transformation 실행

### 기본 실행 (대화형)

```bash
atx custom def exec \
  -p . \
  -n "AWS/early-access-java-x86-to-graviton" \
  -c "mvn clean package -DskipTests"
```

### 비대화형 실행

```bash
atx custom def exec \
  -p . \
  -n "AWS/early-access-java-x86-to-graviton" \
  -c "mvn clean package -DskipTests" \
  -x -t
```

### 전체 옵션

```bash
atx custom def exec --help
```

**출력**:
```
Usage: atx custom def exec [options]

Execute a transformation definition on a code repository

Options:
  -p, --code-repository-path <path>     Path to the code repository to transform
  -c, --build-command <command>         Command to run when building repository
  -n, --transformation-name <name>      Name of the transformation definition
  -x, --non-interactive                 Runs without user assistance
  -t, --trust-all-tools                 Trusts all tools (no prompts)
  -d, --do-not-learn                    Opt out of knowledge extraction
  -g, --configuration <config>          Path to config file or key=value pairs
  --tv, --transformation-version <ver>  Specific version to use
  -h, --help                            Display help
```

### 옵션 상세

| 옵션 | 전체 옵션 | 설명 | 예시 |
|------|----------|------|------|
| `-p` | `--code-repository-path` | 코드 경로 | `-p .` 또는 `-p ./my-project` |
| `-n` | `--transformation-name` | Transformation 이름 | `-n "AWS/early-access-java-x86-to-graviton"` |
| `-c` | `--build-command` | 빌드 명령어 | `-c "mvn clean package"` |
| `-x` | `--non-interactive` | 비대화형 모드 | `-x` |
| `-t` | `--trust-all-tools` | 도구 자동 승인 | `-t` |
| `-d` | `--do-not-learn` | 학습 비활성화 | `-d` |
| `-g` | `--configuration` | 추가 설정 | `-g "file://config.json"` |
| `--tv` | `--transformation-version` | 버전 지정 | `--tv 2025-11-19` |

## 설정 파일 사용

### JSON 설정

```json
// config.json
{
  "additionalPlanContext": "Focus on Dockerfile and JVM optimization",
  "buildCommand": "mvn clean package -DskipTests"
}
```

```bash
atx custom def exec \
  -p . \
  -n "AWS/early-access-java-x86-to-graviton" \
  -g "file://config.json"
```

### YAML 설정

```yaml
# config.yaml
additionalPlanContext: Focus on Dockerfile and JVM optimization
buildCommand: mvn clean package -DskipTests
```

```bash
atx custom def exec \
  -p . \
  -n "AWS/early-access-java-x86-to-graviton" \
  -g "file://config.yaml"
```

### 인라인 설정

```bash
atx custom def exec \
  -p . \
  -n "AWS/early-access-java-x86-to-graviton" \
  -g "additionalPlanContext=The target is AWS Graviton,buildCommand=mvn clean package"
```

## 프로젝트 유형별 예제

### Maven 프로젝트

```bash
atx custom def exec \
  -p . \
  -n "AWS/early-access-java-x86-to-graviton" \
  -c "mvn clean package -DskipTests"
```

### Gradle 프로젝트

```bash
atx custom def exec \
  -p . \
  -n "AWS/early-access-java-x86-to-graviton" \
  -c "./gradlew clean build -x test"
```

### Multi-module Maven 프로젝트

```bash
atx custom def exec \
  -p . \
  -n "AWS/early-access-java-x86-to-graviton" \
  -c "mvn clean package -DskipTests -pl :module-name -am"
```

## 자동화 스크립트 예제

### 단일 프로젝트 변환

```bash
#!/bin/bash
# transform.sh

set -e

PROJECT_PATH="${1:-.}"
TRANSFORMATION="AWS/early-access-java-x86-to-graviton"
BUILD_CMD="mvn clean package -DskipTests"

echo "=== Starting x86 to Graviton Transformation ==="
echo "Project: $PROJECT_PATH"
echo "Transformation: $TRANSFORMATION"

# Git 저장소 확인
if [ ! -d "$PROJECT_PATH/.git" ]; then
    echo "Initializing git repository..."
    cd "$PROJECT_PATH"
    git init
    git add -A
    git commit -m "Initial commit before transformation"
fi

# 변환 실행
atx custom def exec \
  -p "$PROJECT_PATH" \
  -n "$TRANSFORMATION" \
  -c "$BUILD_CMD" \
  -x -t

echo "=== Transformation Complete ==="
echo "Check: $PROJECT_PATH/ARM64-COMPATIBILITY-REPORT.md"
```

### 여러 프로젝트 일괄 변환

```bash
#!/bin/bash
# batch-transform.sh

PROJECTS_DIR="./repositories"
TRANSFORMATION="AWS/early-access-java-x86-to-graviton"
LOG_DIR="./transform-logs"

mkdir -p "$LOG_DIR"

for project in "$PROJECTS_DIR"/*; do
    if [ -d "$project" ]; then
        name=$(basename "$project")
        echo "Processing: $name"

        # Git 초기화
        if [ ! -d "$project/.git" ]; then
            cd "$project"
            git init && git add -A && git commit -m "Initial"
            cd -
        fi

        # 변환 실행
        atx custom def exec \
          -p "$project" \
          -n "$TRANSFORMATION" \
          -c "mvn clean package -DskipTests" \
          -x -t 2>&1 | tee "$LOG_DIR/$name.log"
    fi
done

echo "Batch transformation complete. Logs in $LOG_DIR"
```

### CI/CD 파이프라인용

```bash
#!/bin/bash
# ci-transform.sh

set -e

# 변환 실행
atx custom def exec \
  -p . \
  -n "AWS/early-access-java-x86-to-graviton" \
  -c "mvn clean package -DskipTests" \
  -x -t

# 검증 스크립트 실행
if [ -f "./validate-arm64-build.sh" ]; then
    chmod +x ./validate-arm64-build.sh
    ./validate-arm64-build.sh
fi

# Docker 빌드 테스트
docker buildx build --platform linux/arm64 -t app:arm64-test --load .

echo "CI transformation pipeline complete"
```

## 로그 및 결과물 위치

### 실행 로그

```bash
# 변환 세션 로그
ls ~/.aws/atx/custom/<conversation_id>/logs/

# 아티팩트 (계획, 워크로그 등)
ls ~/.aws/atx/custom/<conversation_id>/artifacts/

# 전역 디버그 로그
ls ~/.aws/atx/logs/
```

### 생성되는 결과물

변환 완료 후 프로젝트 디렉토리에 생성되는 파일:

| 파일 | 설명 |
|------|------|
| `ARM64-COMPATIBILITY-REPORT.md` | 최종 호환성 보고서 |
| `README.md` | 배포 가이드 (업데이트) |
| `CI-CD-INTEGRATION-GUIDE.md` | CI/CD 통합 가이드 |
| `validate-arm64-build.sh` | 빌드 검증 스크립트 |
| `test-arm64-functional.sh` | 기능 테스트 스크립트 |
| `test-arm64-performance.sh` | 성능 테스트 스크립트 |
| `arm64-*.md` | 단계별 분석 문서 |

## 문제 해결

### Git 저장소 오류

```bash
# 오류: "must be managed by git for atx to operate"
git init && git add -A && git commit -m "Initial commit"
```

### 명령어 찾기 오류

```bash
# atx 명령어 위치 확인
which atx
# 또는
ls ~/.local/bin/atx

# PATH에 추가 (필요시)
export PATH="$HOME/.local/bin:$PATH"
```

### 권한 오류

```bash
# AWS 자격 증명 확인
aws sts get-caller-identity

# 자격 증명 재설정
aws configure
```

## 환경 변수

```bash
# AWS 리전 (필요시)
export AWS_DEFAULT_REGION=ap-northeast-2

# AWS 프로필 (필요시)
export AWS_PROFILE=my-profile
```
