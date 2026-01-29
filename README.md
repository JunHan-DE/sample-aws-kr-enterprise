# AWS Korea Enterprise Samples

AWS SEC 팀의 Solutions Architect 들이 고객 지원 과정에서 개발한 기술 도메인별 데모, PoC(Proof of Concept), 테스트 결과물을 공유하는 Repository입니다.

## 🎯 목적

- **실무 검증된 아키텍처**: 실제 고객 환경에서 검증된 AWS 서비스 조합과 베스트 프랙티스
- **빠른 프로토타이핑**: 새로운 프로젝트 시작 시 참고할 수 있는 템플릿과 샘플 코드
- **기술 학습**: AWS 서비스별 핵심 기능과 통합 패턴 학습 자료
- **문제 해결**: 일반적인 기술 과제에 대한 검증된 솔루션

## 📁 도메인 구조

### 🖥️ [Compute](./compute) - 컴퓨팅 서비스
현대적인 애플리케이션 실행을 위한 다양한 컴퓨팅 옵션과 컨테이너 오케스트레이션

**핵심 서비스**: EC2, Lambda, ECS, EKS, Fargate, App Runner

### 💾 [Storage](./storage) - 스토리지 서비스  
확장 가능하고 내구성 있는 데이터 저장 및 백업 솔루션

**핵심 서비스**: S3, S3 Vectors, EBS, EFS, FSx, Backup

### 🗄️ [Database](./database) - 데이터베이스 서비스
관계형, NoSQL, 인메모리, 그래프 데이터베이스 등 다양한 데이터 저장 요구사항 지원

**핵심 서비스**: Aurora, DynamoDB, RDS, ElastiCache, MemoryDB, DocumentDB

### 🌐 [Networking](./networking) - 네트워킹 및 콘텐츠 전송
안전하고 확장 가능한 네트워크 인프라와 글로벌 콘텐츠 배포

**핵심 서비스**: VPC, CloudFront, Route 53, API Gateway, ELB, Transit Gateway

### 📊 [Analytics](./analytics) - 데이터 분석 및 빅데이터
실시간 및 배치 데이터 처리, 비즈니스 인텔리전스, 데이터 레이크 구축

**핵심 서비스**: Athena, Glue, Kinesis, OpenSearch, QuickSight, Redshift, EMR

### 🤖 [AI/ML](./ai-ml) - 인공지능 및 머신러닝
생성형 AI부터 커스텀 ML 모델까지 다양한 AI/ML 워크로드 지원

**핵심 서비스**: Bedrock, SageMaker, Amazon Q Developer, Kiro, Amazon Nova, Rekognition, Textract

### 🔒 [Security](./security) - 보안 및 규정 준수
포괄적인 보안 제어와 규정 준수를 위한 서비스와 모범 사례

**핵심 서비스**: IAM, Cognito, KMS, WAF, GuardDuty, Security Hub

### 🛠️ [Developer Tools](./developer-tools) - 개발자 도구
CI/CD 파이프라인, 인프라스트럭처 as Code, 애플리케이션 모니터링

**핵심 서비스**: Kiro, CDK, CloudFormation, Code*

## 📚 참고 리소스

- [AWS 아키텍처 센터](https://aws.amazon.com/ko/architecture/)
- [AWS Well-Architected Framework](https://aws.amazon.com/ko/architecture/well-architected/)
- [AWS 솔루션 라이브러리](https://aws.amazon.com/ko/solutions/)
- [AWS 샘플 코드](https://github.com/aws-samples)

## ⚠️ 주의사항

- 모든 샘플은 참고 목적으로 제공됩니다
- 프로덕션 환경 적용 전 보안 검토 필수
- AWS 서비스 사용에 따른 비용이 발생할 수 있습니다

## Security
See [CONTRIBUTING](./CONTRIBUTING.md) for more information.

## License
This library is licensed under the MIT-0 License. See the [LICENSE](./LICENSE) file.
