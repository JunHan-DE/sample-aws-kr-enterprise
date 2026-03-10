# EC2 인스턴스 중단 장애 대응

## 증상
- ALB 타겟 unhealthy
- 서비스 불가 또는 성능 저하
- EC2 StatusCheckFailed 알람

## 진단 절차
1. EC2 인스턴스 상태 확인 (stopped/terminated)
2. Auto Scaling Group 상태 확인
3. 인스턴스 중단 원인 확인 (수동/스팟 회수/시스템 오류)

## 조치
1. 중단된 인스턴스 시작 (start_instance)
2. ASG 프로세스 재개 (resume_processes)
3. ALB 헬스체크 정상 복귀 확인

## 조치 명령
- action: start_instance
- parameters: instance_id=INSTANCE_ID
