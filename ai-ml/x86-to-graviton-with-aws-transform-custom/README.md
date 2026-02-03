# AWS Transform Custom을 활용한 x86에서 Graviton 전환 가이드

이 프로젝트는 **AWS Transform Custom** 서비스를 활용하여 x86 기반 Java 애플리케이션을 AWS Graviton(ARM64) 아키텍처로 전환하는 방법을 안내합니다.

## AWS Transform Custom이란?

AWS Transform Custom은 **Agentic AI**를 사용하여 대규모 소프트웨어 현대화를 수행하는 AWS 서비스입니다. 자연어 기반으로 변환 규칙을 정의하고, 이를 여러 코드베이스에 일관되게 적용할 수 있습니다.

### 주요 특징

- **자연어 기반 변환 정의**: 프롬프트, 문서, 코드 샘플로 변환 규칙 생성
- **대규모 일괄 처리**: CLI를 통한 자동화된 대량 실행
- **지속적 학습**: 실행과 피드백을 통해 변환 품질 자동 개선
- **AWS 관리형 변환**: 검증된 변환 템플릿 제공

### AWS 제공 Transformation 목록

| Transformation | 설명 |
|---------------|------|
| `AWS/early-access-java-x86-to-graviton` | **x86 → Graviton 전환** |
| `AWS/java-version-upgrade` | Java 버전 업그레이드 |
| `AWS/java-aws-sdk-v1-to-v2` | AWS SDK v1 → v2 마이그레이션 |
| `AWS/python-version-upgrade` | Python 버전 업그레이드 |
| `AWS/nodejs-version-upgrade` | Node.js 버전 업그레이드 |

## 이 가이드의 목표

1. **x86 → Graviton 전환 검증**: Transform Custom을 사용하여 Java 앱을 Graviton으로 전환 가능함을 검증
2. **Transform Custom 사용법 제공**: 고객이 쉽게 따라할 수 있는 단계별 가이드 제공

## 실제 테스트 결과

### 테스트 환경
- **CLI**: atx v1.1.1
- **Transformation**: `AWS/early-access-java-x86-to-graviton`
- **대상**: Spring Boot 3.2.1 샘플 애플리케이션

### 테스트 결과 요약
- ✅ 8단계 변환 프로세스 전체 완료
- ✅ 100% ARM64 호환 (코드 변경 불필요)
- ✅ Graviton JVM 최적화 자동 적용
- ✅ 문서 및 검증 스크립트 자동 생성

자세한 결과는 [docs/progress.md](docs/progress.md) 참조.

## 문서 구성

| 문서 | 설명 |
|------|------|
| [01. Transform Custom 개요](docs/01-transform-custom-overview.md) | 서비스 소개 및 x86→Graviton 전환 지원 |
| [02. 시작하기](docs/02-getting-started.md) | **atx CLI** 설치 및 환경 설정 |
| [03. Transformation Definition 작성](docs/03-create-transformation.md) | 사용자 정의 변환 규칙 작성법 |
| [04. 변환 실행](docs/04-run-transformation.md) | CLI를 통한 변환 실행 방법 |
| [05. 검증 및 트러블슈팅](docs/05-validation-guide.md) | 결과 검증 및 문제 해결 |
| [진행 상황](docs/progress.md) | 실제 테스트 결과 |

## 프로젝트 구조

```
.
├── docs/                              # 가이드 문서
├── sample-app/                        # 전환 완료된 샘플 Java 애플리케이션
├── transformation-results/            # ⭐ Transform Custom 실행 결과물
│   ├── ARM64-COMPATIBILITY-REPORT.md  # 최종 호환성 보고서
│   ├── CI-CD-INTEGRATION-GUIDE.md     # CI/CD 통합 가이드
│   ├── Dockerfile                     # Graviton 최적화 적용
│   ├── pom.xml                        # ARM64 빌드 프로필 추가
│   ├── *.sh                           # 검증 스크립트 3개
│   └── step-by-step/                  # 단계별 분석 문서 (7개)
├── transformation-definition/         # 사용자 정의 변환 규칙 (참고용)
│   └── x86-to-graviton/
├── examples/                          # CLI 명령어 및 시나리오 예제
│   ├── cli-commands.md                # atx CLI 명령어 가이드
│   └── pilot-scenario.md              # Pilot 시나리오
└── infra/                             # (선택) 검증 환경 CDK
```

## 빠른 시작

### 1. atx CLI 설치

```bash
# 설치 확인
atx --version
# 예상: atx version 1.1.1

# 도움말
atx --help
```

### 2. 사용 가능한 Transformation 확인

```bash
atx custom def list
```

### 3. 변환 실행

```bash
cd your-java-project

# Git 저장소 초기화 (필수)
git init && git add -A && git commit -m "Initial commit"

# Transform Custom 실행
atx custom def exec \
  -p . \
  -n "AWS/early-access-java-x86-to-graviton" \
  -c "mvn clean package -DskipTests"
```

### 4. 결과 확인

```bash
# Git 히스토리 확인 (8개 커밋)
git log --oneline

# 호환성 보고서 확인
cat ARM64-COMPATIBILITY-REPORT.md
```

## CLI 옵션 요약

| 옵션 | 설명 |
|------|------|
| `-p` | 코드 경로 (`.` = 현재 디렉토리) |
| `-n` | Transformation 이름 |
| `-c` | 빌드 명령어 |
| `-x` | 비대화형 모드 |
| `-t` | 모든 도구 자동 승인 |

**비대화형 실행 (자동화용)**:
```bash
atx custom def exec -p . -n "AWS/early-access-java-x86-to-graviton" -c "mvn clean package -DskipTests" -x -t
```

## 변환 결과물

Transform Custom 실행 후 자동 생성되는 파일:

| 파일 | 설명 |
|------|------|
| `ARM64-COMPATIBILITY-REPORT.md` | 최종 호환성 보고서 |
| `CI-CD-INTEGRATION-GUIDE.md` | CI/CD 통합 가이드 |
| `validate-arm64-build.sh` | 빌드 검증 스크립트 |
| `test-arm64-functional.sh` | 기능 테스트 스크립트 |
| `test-arm64-performance.sh` | 성능 테스트 스크립트 |

## 전환 대상 샘플 애플리케이션

- **기술 스택**: Spring Boot 3.2, Java 17, Maven
- **특징**: x86/ARM64 아키텍처 탐지, 벤치마크 API 포함
- **API 엔드포인트**:
  - `GET /api/system-info` - 현재 아키텍처 정보
  - `GET /api/compute/benchmark` - CPU 벤치마크
  - `GET /actuator/health` - 헬스 체크

## 참고 자료

- [AWS Transform Custom 공식 문서](https://docs.aws.amazon.com/transform/latest/userguide/custom.html)
- [AWS Graviton Technical Guide](https://github.com/aws/aws-graviton-getting-started)
- [AWS Graviton Processor](https://aws.amazon.com/ec2/graviton/)
