# Security Group 포트 차단 장애 대응

## 증상
- ALB 헬스체크 실패
- 5xx 에러 급증
- 타겟 인스턴스 unhealthy

## 진단 절차
1. ALB 타겟 그룹 헬스 확인
2. EC2 인스턴스 상태 확인 (running 여부)
3. Security Group 인바운드 규칙 확인
4. 필요한 포트(80, 443)가 열려있는지 확인

## 조치
1. Security Group에 누락된 인바운드 규칙 추가
2. ALB 헬스체크 정상 복귀 확인

## 조치 명령
- action: modify_security_group
- operation: authorize_ingress
- parameters: protocol=tcp, port=80, source=ALB_SECURITY_GROUP_ID
