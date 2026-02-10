# Database

Aurora, DynamoDB, RDS 등 데이터베이스 관련 데모 및 샘플 코드

## 대표 서비스

- Amazon Aurora
- Amazon DynamoDB
- Amazon RDS
- Amazon ElastiCache
- Amazon MemoryDB
- Amazon DocumentDB

## 프로젝트 목록

| 프로젝트 | 설명 | 주요 서비스 |
|---------|------|------------|
| [aurora-mysql-parameter-group-tuning](./aurora-mysql-parameter-group-tuning/) | Aurora MySQL 3.10.3(LTS) Parameter Group 통합 튜닝 가이드. db.r7g.8xlarge(Graviton3) 대상 IDC 호환성 변경 및 Aurora 전용 파라미터 최적화 | Amazon Aurora MySQL |
| [valkey-migration](./valkey-migration/) | Redis 7.4.6에서 ElastiCache for Valkey 8.2로의 온라인 마이그레이션 테스트. CDK TypeScript 인프라 자동화, 마이그레이션 테스트 결과 및 대안 방법 분석 포함 | Amazon ElastiCache, Redis, Valkey |
