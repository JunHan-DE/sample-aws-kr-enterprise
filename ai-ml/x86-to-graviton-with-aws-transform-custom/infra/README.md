# Graviton Migration Infrastructure

AWS CDK를 사용한 x86/Graviton 비교 인프라 구성

## 스택 구성

| 스택 | 설명 | 주요 리소스 |
|------|------|-------------|
| **VpcStack** | 네트워크 인프라 | VPC, Subnets, NAT Gateway |
| **EcrStack** | 컨테이너 레지스트리 | ECR Repository |
| **Ec2X86Stack** | x86 비교 인스턴스 | t3.medium (x86_64) |
| **Ec2GravitonStack** | Graviton 대상 인스턴스 | t4g.medium (ARM64) |

## 사전 요구사항

- Node.js 18+
- AWS CLI v2 (설정 완료)
- AWS CDK CLI (`npm install -g aws-cdk`)

## 설치

```bash
cd infra
npm install
```

## 배포

### 전체 스택 배포

```bash
npm run deploy:all
```

### 개별 스택 배포

```bash
# VPC 먼저 배포 (필수)
npm run deploy:vpc

# ECR 배포
npm run deploy:ecr

# x86 인스턴스 배포
npm run deploy:x86

# Graviton 인스턴스 배포
npm run deploy:graviton
```

### 변경사항 미리보기

```bash
npm run diff
```

### 삭제

```bash
npm run destroy:all
```

## 인스턴스 접속

### SSM Session Manager (권장)

```bash
# x86 인스턴스
aws ssm start-session --target <x86-instance-id>

# Graviton 인스턴스
aws ssm start-session --target <graviton-instance-id>
```

### SSH (키페어 설정 시)

```bash
ssh -i <key.pem> ec2-user@<public-ip>
```

## 애플리케이션 배포

### 1. Docker 이미지 빌드 및 푸시

```bash
# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com

# Multi-arch 이미지 빌드 및 푸시
cd ../sample-app
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com/graviton-demo:latest \
  --push .
```

### 2. EC2에서 이미지 실행

```bash
# 인스턴스에 접속 후
docker pull <ecr-uri>:latest
docker run -d -p 8080:8080 <ecr-uri>:latest
```

## 비용 비교

| 인스턴스 | 타입 | 시간당 비용 (서울) | 월 비용 (730h) |
|----------|------|-------------------|----------------|
| x86 | t3.medium | $0.052 | ~$38 |
| Graviton | t4g.medium | $0.042 | ~$31 |
| **절감** | | **19%** | **~$7/월** |

> 실제 프로덕션 워크로드에서는 m6g, c6g 등 더 큰 인스턴스에서 절감 효과가 큽니다.

## 아키텍처

```
                    ┌─────────────────────────────────────┐
                    │              VPC (10.0.0.0/16)      │
                    │                                     │
                    │  ┌──────────────┐ ┌──────────────┐ │
                    │  │ Public       │ │ Public       │ │
                    │  │ Subnet A     │ │ Subnet B     │ │
                    │  │              │ │              │ │
                    │  │ ┌──────────┐ │ │ ┌──────────┐ │ │
Internet ──────────────▶│  x86     │ │ │ │ Graviton │ │ │
                    │  │ t3.medium │ │ │ │ t4g.medium│ │ │
                    │  │  :8080    │ │ │ │  :8080   │ │ │
                    │  │ └──────────┘ │ │ └──────────┘ │ │
                    │  └──────────────┘ └──────────────┘ │
                    │                                     │
                    │  ┌──────────────┐ ┌──────────────┐ │
                    │  │ Private      │ │ Private      │ │
                    │  │ Subnet A     │ │ Subnet B     │ │
                    │  └──────────────┘ └──────────────┘ │
                    │                                     │
                    └─────────────────────────────────────┘
                                      │
                                      ▼
                              ┌───────────────┐
                              │      ECR      │
                              │ graviton-demo │
                              │  (multi-arch) │
                              └───────────────┘
```

## 참고

- [AWS Graviton Technical Guide](https://github.com/aws/aws-graviton-getting-started)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/v2/guide/home.html)
