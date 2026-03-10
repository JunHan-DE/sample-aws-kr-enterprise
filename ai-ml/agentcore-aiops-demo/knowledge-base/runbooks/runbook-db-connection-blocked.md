# DB 연결 차단 장애 대응

## 증상
- 백엔드 DB 연결 타임아웃
- 500 에러 응답
- RDS DatabaseConnections = 0

## 진단 절차
1. RDS 인스턴스 상태 확인 (available 여부)
2. RDS Security Group 인바운드 규칙 확인
3. EC2 → RDS 네트워크 경로 확인
4. 5432 포트가 EC2 Security Group에서 허용되는지 확인

## 조치
1. RDS Security Group에 누락된 인바운드 규칙 추가
2. DB 연결 복구 확인

## 조치 명령
- action: modify_security_group
- operation: authorize_ingress
- parameters: protocol=tcp, port=5432, source=EC2_SECURITY_GROUP_ID
