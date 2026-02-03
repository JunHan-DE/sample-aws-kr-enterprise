import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

/**
 * ECR 스택
 * Multi-architecture 이미지를 저장하기 위한 ECR 레포지토리
 */
export class EcrStack extends cdk.Stack {
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ECR 레포지토리 생성
    this.repository = new ecr.Repository(this, 'GravitonDemoRepo', {
      repositoryName: 'graviton-demo',
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      lifecycleRules: [
        {
          description: 'Keep only 10 untagged images',
          rulePriority: 1,
          tagStatus: ecr.TagStatus.UNTAGGED,
          maxImageCount: 10,
        },
        {
          description: 'Keep only 20 tagged images',
          rulePriority: 2,
          tagStatus: ecr.TagStatus.TAGGED,
          tagPrefixList: ['v'],
          maxImageCount: 20,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 데모용 - 프로덕션에서는 RETAIN 사용
      emptyOnDelete: true, // 데모용 - 삭제 시 이미지도 함께 삭제
    });

    // Outputs
    new cdk.CfnOutput(this, 'RepositoryUri', {
      value: this.repository.repositoryUri,
      description: 'ECR Repository URI',
      exportName: 'GravitonDemo-EcrUri',
    });

    new cdk.CfnOutput(this, 'RepositoryArn', {
      value: this.repository.repositoryArn,
      description: 'ECR Repository ARN',
    });

    // Docker push 명령어 출력
    new cdk.CfnOutput(this, 'DockerPushCommand', {
      value: `docker buildx build --platform linux/amd64,linux/arm64 -t ${this.repository.repositoryUri}:latest --push .`,
      description: 'Multi-arch Docker push command',
    });
  }
}
