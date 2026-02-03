# 03. Transformation Definition 작성

이 문서에서는 x86→Graviton 변환을 위한 Transformation Definition 작성 방법을 안내합니다.

## Transformation Definition 구조

```
transformation-definition/
└── x86-to-graviton/
    ├── transformation_definition.md   # (필수) 핵심 변환 규칙
    ├── summaries.md                   # (선택) 참조 문서 요약
    └── document_references/           # (선택) 참조 문서
        ├── graviton-compatibility.md
        ├── native-library-mapping.md
        └── jvm-options.md
```

## transformation_definition.md 작성

### 기본 구조

```markdown
# [변환 이름] Transformation Definition

## Overview
변환의 목적과 범위를 설명합니다.

## Transformation Goals
변환 목표를 나열합니다.

## Transformation Rules
구체적인 변환 규칙을 정의합니다.

### Rule 1: [규칙 이름]
**Context**: 왜 이 규칙이 필요한지
**Find patterns**: 찾을 패턴
**Action**: 수행할 작업
**Example**: 변환 전후 예시

## Files to Transform
대상 파일 패턴을 정의합니다.

## Validation Checks
변환 후 검증 방법을 정의합니다.
```

### x86→Graviton 변환 규칙 예시

#### 규칙 1: JVM 옵션 제거

```markdown
### Rule 1: JVM Options - Remove x86-Specific Options

**Context**: x86 프로세서의 AVX, SSE 등 명령어셋은 ARM64에서 지원되지 않습니다.

**Find patterns**:
- `-XX:+UseAVX`
- `-XX:+UseAVX2`
- `-XX:+UseAVX512`
- `-XX:+UseSHA`
- `-XX:UseSSE=N`

**Action**: 위 옵션을 Dockerfile, 쉘 스크립트, 설정 파일에서 제거

**Example**:
\`\`\`diff
# Before
- JAVA_OPTS="-Xmx2g -XX:+UseAVX2 -XX:+UseSHA"
# After
+ JAVA_OPTS="-Xmx2g"
\`\`\`
```

#### 규칙 2: 의존성 업그레이드

```markdown
### Rule 2: Native Library Dependencies

**Context**: 일부 라이브러리는 ARM64용 네이티브 바이너리가 특정 버전부터 포함됩니다.

**Dependency mapping**:
| Library | Min ARM64 Version | Recommended |
|---------|------------------|-------------|
| snappy-java | 1.1.8.0 | 1.1.10.5 |
| rocksdbjni | 6.22.1 | 7.10.2 |

**Action for Maven**:
\`\`\`xml
<dependency>
    <groupId>org.xerial.snappy</groupId>
    <artifactId>snappy-java</artifactId>
    <version>1.1.10.5</version>
</dependency>
\`\`\`
```

## 참조 문서 작성

### summaries.md

참조 문서의 핵심 내용을 요약합니다.

```markdown
# Reference Document Summaries

## 1. AWS Graviton 호환성 가이드

### 핵심 내용
- Java는 JVM 위에서 실행되어 대부분 호환됨
- 주의 영역: JNI 라이브러리, JVM 옵션

### 주의 영역
| 영역 | 해결 방법 |
|------|-----------|
| JNI 라이브러리 | ARM64용 버전 사용 |
| JVM 옵션 | x86 전용 옵션 제거 |
```

### document_references/

상세 참조 문서를 폴더에 저장합니다.

```
document_references/
├── graviton-compatibility.md   # Graviton 호환성 상세 정보
├── native-library-mapping.md   # 라이브러리별 ARM64 버전 정보
└── jvm-options.md              # JVM 옵션 가이드
```

## 이 프로젝트의 Transformation Definition

이 프로젝트에 포함된 x86→Graviton 변환 정의:

### 변환 목표

1. x86 전용 JVM 옵션 제거
2. ARM64 최적화 JVM 옵션 추가
3. 네이티브 라이브러리 의존성 업그레이드
4. Docker Multi-arch 지원 설정
5. 아키텍처 탐지 코드 패턴 업데이트

### 파일 위치

```bash
# Transformation Definition 확인
cat transformation-definition/x86-to-graviton/transformation_definition.md

# 참조 문서 확인
ls transformation-definition/x86-to-graviton/document_references/
```

## 커스텀 변환 정의 생성

### 1. 디렉토리 생성

```bash
mkdir -p transformation-definition/my-custom-transform/document_references
```

### 2. 핵심 파일 작성

```bash
cat > transformation-definition/my-custom-transform/transformation_definition.md << 'EOF'
# My Custom Transformation

## Overview
[변환 설명]

## Transformation Rules
[규칙 정의]
EOF
```

### 3. 검증

```bash
# 변환 정의 구조 확인
tree transformation-definition/my-custom-transform/

# 사용자 정의 Transformation 배포 (atx CLI 사용)
atx custom def publish \
  -p ./transformation-definition/my-custom-transform \
  -n "my-custom-transform"

# 또는 AWS 관리형 Transformation 사용 (권장)
atx custom def list  # 사용 가능한 AWS 관리형 목록 확인
```

## 베스트 프랙티스

### 1. 명확한 컨텍스트 제공

각 규칙에 "왜 필요한지"를 명확히 설명합니다.

```markdown
**Context**: x86 프로세서의 AVX 명령어셋은 ARM64에서 지원되지 않아
JVM 시작 시 오류가 발생합니다.
```

### 2. 구체적인 예시 포함

변환 전후를 diff 형식으로 보여줍니다.

```diff
# Before
- ENV JAVA_OPTS="-XX:+UseAVX2"
# After
+ ENV JAVA_OPTS="-XX:+UseG1GC"
```

### 3. 파일 패턴 명시

어떤 파일에 규칙을 적용할지 명확히 합니다.

```markdown
## Files to Transform
| File Pattern | Rules |
|--------------|-------|
| Dockerfile | Rule 1, 2, 4 |
| pom.xml | Rule 3 |
```

### 4. 검증 체크리스트 포함

변환 후 확인해야 할 항목을 정의합니다.

```markdown
## Validation Checks
1. 빌드 성공: `mvn clean package`
2. 테스트 통과: `mvn test`
3. Docker ARM64 빌드: `docker buildx build --platform linux/arm64 .`
```

## 다음 단계

[04. 변환 실행](04-run-transformation.md)에서 CLI를 통한 변환 실행 방법을 확인하세요.
