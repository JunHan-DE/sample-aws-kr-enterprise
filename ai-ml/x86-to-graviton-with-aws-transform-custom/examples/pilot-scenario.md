# x86 → Graviton 전환 Pilot 시나리오

이 문서는 AWS Transform Custom을 사용하여 x86 Java 애플리케이션을 Graviton으로 전환하는 Pilot(PoC) 시나리오를 제공합니다.

## 시나리오 개요

### 전환 대상

- **애플리케이션**: Spring Boot 기반 REST API
- **현재 환경**: x86 EC2 인스턴스 (t3.medium)
- **목표 환경**: Graviton EC2 인스턴스 (t4g.medium)

### 예상 결과

- 비용 절감: ~20-40%
- 성능: 동등 이상 (10-15% 개선 예상)
- 코드 변경: 최소화 (Pure Java의 경우 없음)

## Phase 1: 준비

### 1.1 사전 요구사항 확인

```bash
# atx CLI 설치 확인
atx --version
# 예상: atx version 1.1.1

# AWS 자격 증명 확인
aws sts get-caller-identity

# Java 버전 확인
java -version

# Maven/Gradle 확인
mvn -version
```

### 1.2 프로젝트 준비

```bash
# 프로젝트 디렉토리로 이동
cd your-java-project

# Git 저장소 초기화 (필수)
git init
git add -A
git commit -m "Initial commit before Graviton transformation"

# 빌드 테스트
mvn clean package -DskipTests
```

### 1.3 사용 가능한 Transformation 확인

```bash
atx custom def list
```

**x86→Graviton 변환용**:
```
AWS/early-access-java-x86-to-graviton
```

## Phase 2: 변환 실행

### 2.1 Transform Custom 실행

```bash
# 대화형 실행 (권장 - 첫 실행 시)
atx custom def exec \
  -p . \
  -n "AWS/early-access-java-x86-to-graviton" \
  -c "mvn clean package -DskipTests"

# 또는 비대화형 실행 (자동화용)
atx custom def exec \
  -p . \
  -n "AWS/early-access-java-x86-to-graviton" \
  -c "mvn clean package -DskipTests" \
  -x -t
```

### 2.2 변환 과정 모니터링

실행 시 8단계의 자동화된 프로세스가 진행됩니다:

1. **Static Compatibility Analysis** - 정적 분석 (~2분)
2. **Dependency ARM64 Validation** - 의존성 검증 (~2분)
3. **JVM Optimizations** - Graviton JVM 최적화 (~1분)
4. **Maven ARM64 Profile** - 빌드 프로필 추가 (~1분)
5. **Build Validation** - 빌드 검증 스크립트 생성 (~2분)
6. **Functional Testing** - 기능 테스트 문서화 (~2분)
7. **Performance Validation** - 성능 테스트 스크립트 (~2분)
8. **CI/CD and Documentation** - CI/CD 가이드 (~2분)

총 예상 시간: **15-20분**

### 2.3 변환 결과 확인

```bash
# Git 커밋 히스토리 확인
git log --oneline

# 생성된 파일 확인
ls -la *.md *.sh

# 호환성 보고서 확인
cat ARM64-COMPATIBILITY-REPORT.md
```

**예상 결과**:
- 8개의 Git 커밋 (단계별)
- 호환성 보고서 (`ARM64-COMPATIBILITY-REPORT.md`)
- CI/CD 가이드 (`CI-CD-INTEGRATION-GUIDE.md`)
- 검증 스크립트 3개 (`.sh` 파일)

## Phase 3: 검증

### 3.1 빌드 검증

```bash
# Maven 빌드
mvn clean package
# 예상: BUILD SUCCESS

# 테스트 실행
mvn test
# 예상: Tests: X, Failures: 0
```

### 3.2 Docker 이미지 빌드

```bash
# Multi-arch 빌더 설정
docker buildx create --name multiarch --use 2>/dev/null || docker buildx use multiarch

# ARM64 이미지 빌드
docker buildx build \
  --platform linux/arm64 \
  -t graviton-demo:pilot \
  --load \
  .

# 이미지 아키텍처 확인
docker inspect graviton-demo:pilot --format '{{.Architecture}}'
# 예상: arm64
```

### 3.3 로컬 실행 테스트

```bash
# 컨테이너 실행
docker run -d -p 8080:8080 --name pilot-test graviton-demo:pilot

# 시작 대기
sleep 15

# 헬스 체크
curl http://localhost:8080/actuator/health
# 예상: {"status":"UP"}

# 아키텍처 확인
curl http://localhost:8080/api/system-info
# 예상: {"osArch":"aarch64","architectureType":"ARM64 (Graviton)"}

# 정리
docker stop pilot-test && docker rm pilot-test
```

### 3.4 자동화된 검증 스크립트 실행

```bash
# 빌드 검증
chmod +x validate-arm64-build.sh
./validate-arm64-build.sh

# 기능 테스트 (Docker 실행 중일 때)
chmod +x test-arm64-functional.sh
./test-arm64-functional.sh

# 성능 테스트
chmod +x test-arm64-performance.sh
./test-arm64-performance.sh
```

## Phase 4: Graviton 인스턴스 배포

### 4.1 ECR에 이미지 푸시

```bash
# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com

# Multi-arch 이미지 빌드 및 푸시
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com/graviton-demo:pilot \
  --push \
  .
```

### 4.2 Graviton 인스턴스 생성

```bash
# AWS CLI로 Graviton 인스턴스 생성
aws ec2 run-instances \
  --image-id ami-0123456789abcdef0 \
  --instance-type t4g.medium \
  --key-name my-key \
  --security-group-ids sg-xxx \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=graviton-pilot}]'
```

**권장 인스턴스 타입**:
| 타입 | vCPU | 메모리 | 용도 |
|------|------|--------|------|
| t4g.medium | 2 | 4 GB | 개발/테스트 |
| m7g.medium | 1 | 4 GB | 소규모 프로덕션 |
| c7g.large | 2 | 4 GB | 컴퓨트 집약 |

### 4.3 애플리케이션 배포

```bash
# SSM으로 인스턴스 접속
aws ssm start-session --target <instance-id>

# Docker 설치 (Amazon Linux 2023)
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# ECR 로그인 및 이미지 풀
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com

docker pull <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com/graviton-demo:pilot

# 컨테이너 실행
docker run -d -p 8080:8080 --name app \
  <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com/graviton-demo:pilot
```

## Phase 5: 성능 비교

### 5.1 벤치마크 실행

```bash
# x86 인스턴스
X86_IP="<x86-instance-ip>"
curl "http://$X86_IP:8080/api/compute/benchmark?iterations=100000"

# Graviton 인스턴스
GRAVITON_IP="<graviton-instance-ip>"
curl "http://$GRAVITON_IP:8080/api/compute/benchmark?iterations=100000"
```

### 5.2 결과 비교

| 메트릭 | x86 (t3.medium) | Graviton (t4g.medium) | 차이 |
|--------|-----------------|----------------------|------|
| 벤치마크 시간 | ~150ms | ~130ms | -13% |
| 응답 시간 (P50) | ~10ms | ~8ms | -20% |
| 응답 시간 (P99) | ~50ms | ~40ms | -20% |
| 시간당 비용 | $0.052 | $0.042 | -19% |

## Phase 6: 결과 보고

### Pilot 결과 요약 템플릿

```markdown
# x86 → Graviton 전환 Pilot 결과

## 요약
- **Transform Custom 결과**: 8단계 전체 완료
- **호환성**: 100% ARM64 호환 (코드 변경 불필요)
- **빌드/테스트**: 모두 통과
- **성능**: 10-15% 개선
- **비용 절감**: ~20-40%

## 변환된 항목
- Dockerfile: Graviton JVM 최적화 플래그 적용
- pom.xml: ARM64 빌드 프로필 추가
- docker-compose.yml: Multi-arch 지원

## 권장사항
1. 전체 프로젝트에 Transform Custom 적용
2. 점진적 배포 (Canary → 전체)
3. 모니터링 설정 후 x86 인스턴스 종료
```

## 다음 단계

Pilot 성공 후:

1. **전체 프로젝트 변환**: 다른 마이크로서비스에도 Transform Custom 적용
2. **CI/CD 파이프라인 통합**: `CI-CD-INTEGRATION-GUIDE.md` 참조
3. **프로덕션 배포**: Blue/Green 또는 Canary 배포
4. **비용 모니터링**: CloudWatch로 비용 절감 효과 추적

## 체크리스트

### 변환 전
- [ ] atx CLI 설치 확인
- [ ] AWS 자격 증명 설정
- [ ] Git 저장소 초기화
- [ ] 빌드 명령어 확인 (Maven/Gradle)

### 변환 후
- [ ] Git 커밋 히스토리 확인 (8개 커밋)
- [ ] 호환성 보고서 검토
- [ ] 빌드 검증 스크립트 실행
- [ ] Docker ARM64 이미지 빌드 테스트
- [ ] 로컬 실행 테스트

### 배포 전
- [ ] ECR에 Multi-arch 이미지 푸시
- [ ] Graviton 인스턴스 생성
- [ ] 보안 그룹 설정
- [ ] 모니터링 설정

### 배포 후
- [ ] 헬스 체크 확인
- [ ] 아키텍처 정보 확인
- [ ] 성능 벤치마크 실행
- [ ] 비용 비교 분석
