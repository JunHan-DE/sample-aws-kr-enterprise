# AWS Korea Enterprise Samples

AWS Enterprise 팀의 Solutions Architect(SA)들이 고객 지원 과정에서 개발한 기술 자산을 공유하는 레포지토리입니다.

실제 엔터프라이즈 고객 환경에서 검증된 아키텍처 패턴, 마이그레이션 가이드, 파라미터 튜닝, PoC(Proof of Concept), 개발 워크플로우 등을 기술 도메인별로 정리하여 팀 안팎에서 재사용할 수 있도록 합니다.

## 어떤 컨텐츠가 있나요?

이 레포지토리에는 SA들이 고객 프로젝트를 수행하며 축적한 다양한 유형의 기술 자산이 포함되어 있습니다.

- **데모 및 샘플 코드** - 특정 서비스의 기능을 시연하는 동작 가능한 예제
- **PoC 결과물** - 기술 검증을 위해 수행한 개념 증명 프로젝트
- **마이그레이션 테스트** - 서비스 간 전환 또는 버전 업그레이드에 대한 테스트 결과 및 가이드
- **파라미터 튜닝 가이드** - 엔터프라이즈 워크로드에 최적화된 설정값과 근거
- **아키텍처 패턴** - 실전에서 검증된 설계 패턴과 모범 사례
- **개발 워크플로우** - 생산성 향상을 위한 도구 활용법 및 자동화 패턴

## 대상 독자

- AWS Solutions Architect 및 기술 지원 인력
- 클라우드 아키텍트 및 인프라 엔지니어
- AWS 서비스를 활용하는 백엔드/풀스택 개발자
- 엔터프라이즈 환경에서 AWS 도입을 검토하는 기술 의사결정자

## 기술 도메인

각 도메인 폴더에는 해당 영역의 프로젝트 목록, 대표 서비스, 참고 리소스가 정리되어 있습니다.

| | 도메인 | 설명 |
|--|--------|------|
| 🤖 | [AI/ML](./ai-ml) | 생성형 AI, 머신러닝 모델 학습 및 배포, AI 서비스 활용 |
| 📊 | [Analytics](./analytics) | 데이터 수집, ETL 파이프라인, 실시간 스트리밍, 데이터 웨어하우스 |
| 🖥️ | [Compute](./compute) | 가상 서버, 서버리스, 컨테이너 오케스트레이션 |
| 🗄️ | [Database](./database) | 관계형, NoSQL, 인메모리 데이터베이스 운영 및 마이그레이션 |
| 🛠️ | [Developer Tools](./developer-tools) | AI 기반 개발 도구, IaC, CI/CD 파이프라인 |
| 🌐 | [Networking](./networking) | 가상 네트워크, CDN, DNS, API 관리, 로드 밸런싱 |
| 🔒 | [Security](./security) | 자격 증명, 암호화, 위협 탐지, 규정 준수 |
| 💾 | [Storage](./storage) | 객체, 블록, 파일 스토리지 및 데이터 보호 |

## 참고 리소스

- [AWS 아키텍처 센터](https://aws.amazon.com/ko/architecture/) - AWS 참조 아키텍처 및 모범 사례
- [AWS Well-Architected Framework](https://aws.amazon.com/ko/architecture/well-architected/) - 클라우드 워크로드 설계 원칙
- [AWS 솔루션 라이브러리](https://aws.amazon.com/ko/solutions/) - 검증된 기술 솔루션 모음
- [AWS 샘플 코드](https://github.com/aws-samples) - AWS 공식 샘플 코드 레포지토리

## 주의사항

- 모든 샘플은 참고 목적으로 제공됩니다
- 프로덕션 환경 적용 전 보안 검토 필수
- AWS 서비스 사용에 따른 비용이 발생할 수 있습니다

## Security

See [CONTRIBUTING](./CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the [LICENSE](./LICENSE) file.
