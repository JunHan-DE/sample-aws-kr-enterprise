# AWS Korea Enterprise Samples

AWS Enterprise 팀의 Solutions Architect들이 고객 지원 과정에서 개발한 기술 도메인별 데모, PoC(Proof of Concept), 테스트 결과물을 공유하는 Repository입니다.

## 도메인

| | 도메인 | 설명 |
|--|--------|------|
| 🤖 | [AI/ML](./ai-ml) | Bedrock, SageMaker, Nova 등 AI/ML 워크로드 |
| 📊 | [Analytics](./analytics) | Athena, Glue, Kinesis 등 데이터 분석 |
| 🖥️ | [Compute](./compute) | EC2, Lambda, ECS/EKS 등 컴퓨팅 |
| 🗄️ | [Database](./database) | Aurora, DynamoDB, ElastiCache 등 데이터베이스 |
| 🛠️ | [Developer Tools](./developer-tools) | Kiro, CDK, CloudFormation 등 개발 도구 |
| 🌐 | [Networking](./networking) | VPC, CloudFront, Route 53 등 네트워킹 |
| 🔒 | [Security](./security) | IAM, KMS, WAF, GuardDuty 등 보안 |
| 💾 | [Storage](./storage) | S3, EBS, EFS 등 스토리지 |

## 프로젝트

| 프로젝트 | 도메인 | 설명 |
|---------|--------|------|
| [x86-to-graviton-with-aws-transform-custom](./ai-ml/x86-to-graviton-with-aws-transform-custom/) | AI/ML | AWS Transform Custom 기반 x86 Java 앱의 Graviton(ARM64) 전환 가이드 |
| [aurora-mysql-parameter-group-tuning](./database/aurora-mysql-parameter-group-tuning/) | Database | Aurora MySQL 3.10.3 Parameter Group 통합 튜닝 가이드 |
| [valkey-migration](./database/valkey-migration/) | Database | Redis → ElastiCache for Valkey 온라인 마이그레이션 테스트 |
| [structured-ai-dev-workflow](./developer-tools/structured-ai-dev-workflow/) | Developer Tools | Kiro Subagent 기반 Multi-agent AI 개발 워크플로우 |

## 참고 리소스

- [AWS 아키텍처 센터](https://aws.amazon.com/ko/architecture/)
- [AWS Well-Architected Framework](https://aws.amazon.com/ko/architecture/well-architected/)
- [AWS 솔루션 라이브러리](https://aws.amazon.com/ko/solutions/)
- [AWS 샘플 코드](https://github.com/aws-samples)

## 주의사항

- 모든 샘플은 참고 목적으로 제공됩니다
- 프로덕션 환경 적용 전 보안 검토 필수
- AWS 서비스 사용에 따른 비용이 발생할 수 있습니다

## Security

See [CONTRIBUTING](./CONTRIBUTING.md) for more information.

## License

This library is licensed under the MIT-0 License. See the [LICENSE](./LICENSE) file.
