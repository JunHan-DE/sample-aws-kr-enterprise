# 01. AWS Transform Custom 개요

## AWS Transform Custom이란?

AWS Transform Custom은 **Agentic AI**를 사용하여 대규모 소프트웨어 현대화를 수행하는 AWS 서비스입니다. 기술 부채를 줄이기 위한 다양한 변환 시나리오를 처리합니다:

- 언어 버전 업그레이드
- API 및 서비스 마이그레이션
- 프레임워크 업그레이드 및 마이그레이션
- 코드 리팩토링
- **아키텍처 마이그레이션 (x86 → Graviton)**
- 조직별 커스텀 변환

## 핵심 기능

### 1. 자연어 기반 변환 정의

프로그래밍 없이 자연어, 문서, 코드 샘플을 사용하여 변환 규칙을 정의합니다.

```markdown
# 예시: transformation_definition.md

## 목표
x86 전용 JVM 옵션을 제거하고 ARM64 호환 옵션으로 변환합니다.

## 변환 규칙
1. -XX:+UseAVX, -XX:+UseAVX2 옵션 제거
2. -XX:+UseG1GC 옵션 추가 (없는 경우)
3. -XX:+UseContainerSupport 옵션 추가
```

### 2. 대규모 일괄 처리

CLI를 통해 여러 코드베이스에 동일한 변환을 일괄 적용합니다.

```bash
# atx CLI를 사용한 변환 실행
atx custom def exec \
  -p ./my-project \
  -n "AWS/early-access-java-x86-to-graviton" \
  -c "mvn clean package -DskipTests"
```

### 3. 지속적 학습

매 실행과 개발자 피드백을 통해 변환 품질이 자동으로 개선됩니다.

### 4. AWS 관리형 변환

AWS에서 검증한 일반적인 시나리오용 변환 템플릿을 제공합니다.

## 지원하는 변환 패턴

| 패턴 | 복잡도 | 예시 |
|------|--------|------|
| API/서비스 마이그레이션 | Medium | AWS SDK v1→v2, JUnit 4→5, javax→jakarta |
| 언어 버전 업그레이드 | Low-Medium | Java 8→17, Python 3.9→3.13 |
| 프레임워크 업그레이드 | Medium | Spring Boot 2.x→3.x, React 17→18 |
| 프레임워크 마이그레이션 | High | Angular→React |
| 라이브러리 업그레이드 | Low-Medium | Pandas 1.x→2.x |
| 코드 리팩토링 | Low-Medium | Print→Logging, 타입 힌트 적용 |
| **아키텍처 마이그레이션** | **Medium-High** | **x86→AWS Graviton (ARM64)** |
| 언어 간 마이그레이션 | Very High | Java→Python |

## x86 → Graviton 전환 지원

### 전환 대상 항목

AWS Transform Custom은 x86에서 Graviton으로 전환 시 다음 항목을 자동으로 처리합니다:

| 카테고리 | 변환 내용 |
|----------|-----------|
| **JVM 옵션** | x86 전용 옵션 제거 (`-XX:+UseAVX`, `-XX:+UseSHA` 등) |
| **네이티브 의존성** | ARM64 호환 버전으로 업그레이드 제안 |
| **Dockerfile** | Multi-arch 빌드 지원 추가 |
| **빌드 설정** | ARM64 플랫폼 지원 설정 |

### 변환 복잡도: Medium-High

x86→Graviton 전환은 대부분의 순수 Java 코드는 수정 없이 동작하지만, 다음 경우 추가 작업이 필요합니다:

- 네이티브 라이브러리 (JNI) 사용
- x86 전용 JVM 최적화 옵션
- 아키텍처 의존적 빌드 설정

## 4단계 워크플로우

AWS Transform Custom은 대규모 프로젝트에서 다음 4단계 워크플로우를 따릅니다:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  1. Define      │ →  │  2. Pilot       │ →  │  3. Execute     │ →  │  4. Monitor     │
│                 │    │                 │    │                 │    │                 │
│ 변환 규칙 정의   │    │ PoC로 검증      │    │ 대규모 실행     │    │ 리뷰 및 학습    │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 1단계: Define Transformation

자연어 프롬프트, 문서, 코드 샘플을 제공하여 변환 정의를 생성합니다.

- AWS 관리형 변환 사용 시 이 단계 생략 가능
- 채팅 또는 직접 편집으로 반복 개선

### 2단계: Pilot / PoC

샘플 코드베이스에서 변환을 테스트하고 결과를 검증합니다.

- 전체 변환의 비용과 노력 추정
- 이 단계에서 지속적 학습으로 품질 개선

### 3단계: Scaled Execution

CLI를 사용하여 자동화된 대량 실행을 수행합니다.

- 개발자가 결과 리뷰 및 검증
- 웹 애플리케이션으로 진행 상황 모니터링

### 4단계: Monitor and Review

지속적 학습으로 변환 품질이 자동 개선됩니다.

- 실행에서 추출된 지식 항목 리뷰 및 승인
- 품질 기준 충족 확인

## Transformation Definition 구조

변환 정의는 다음 파일들로 구성됩니다:

```
transformation-definition/
└── x86-to-graviton/
    ├── transformation_definition.md   # (필수) 핵심 변환 로직 및 지침
    ├── summaries.md                   # (선택) 참조 문서 요약
    └── document_references/           # (선택) 참조 문서
        ├── graviton-compatibility.md
        └── native-library-mapping.md
```

### transformation_definition.md (필수)

변환의 핵심 로직과 지침을 담은 필수 파일입니다.

### summaries.md (선택)

사용자 제공 참조 문서의 요약본입니다.

### document_references/ (선택)

변환에 필요한 참조 문서를 저장하는 폴더입니다.

## 다음 단계

[02. 시작하기](02-getting-started.md)에서 CLI 설치 및 환경 설정 방법을 확인하세요.
