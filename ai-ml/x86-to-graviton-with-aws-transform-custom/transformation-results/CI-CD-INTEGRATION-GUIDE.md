# CI/CD Integration Guide for Multi-Architecture Builds

This guide provides comprehensive CI/CD pipeline configurations for building and deploying multi-architecture (ARM64 and x86) Docker images.

## Overview

Building multi-architecture images allows a single Docker image to run on multiple CPU architectures (ARM64/Graviton and x86/amd64) without modification.

### Benefits
- Single image tag for all architectures
- Automatic architecture selection at runtime
- Simplified deployment across mixed infrastructure
- Optimal performance on each architecture

## GitHub Actions

### Complete Multi-Architecture Workflow

```yaml
name: Multi-Architecture Build and Push

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}/graviton-demo

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v2
        with:
          platforms: arm64,amd64

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
        with:
          platforms: linux/arm64,linux/amd64

      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=sha

      - name: Build and push multi-arch image
        uses: docker/build-push-action@v4
        with:
          context: .
          platforms: linux/arm64,linux/amd64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Test ARM64 image
        run: |
          docker pull --platform linux/arm64 ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:sha-${{ github.sha }}
          docker run --rm --platform linux/arm64 \
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:sha-${{ github.sha }} \
            java -version

      - name: Test x86 image
        run: |
          docker pull --platform linux/amd64 ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:sha-${{ github.sha }}
          docker run --rm --platform linux/amd64 \
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:sha-${{ github.sha }} \
            java -version
```

### Separate ARM64 and x86 Jobs

For faster builds using native runners:

```yaml
name: Multi-Architecture Build (Parallel)

on: [push, pull_request]

jobs:
  build-arm64:
    runs-on: ubuntu-latest-arm64  # GitHub-hosted ARM64 runner (if available)
    steps:
      - uses: actions/checkout@v3
      
      - name: Build ARM64 image
        run: docker build -t graviton-demo:arm64 .
      
      - name: Push ARM64 image
        run: docker push graviton-demo:arm64

  build-x86:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build x86 image
        run: docker build -t graviton-demo:amd64 .
      
      - name: Push x86 image
        run: docker push graviton-demo:amd64

  create-manifest:
    needs: [build-arm64, build-x86]
    runs-on: ubuntu-latest
    steps:
      - name: Create multi-arch manifest
        run: |
          docker manifest create graviton-demo:latest \
            graviton-demo:arm64 \
            graviton-demo:amd64
          docker manifest push graviton-demo:latest
```

## AWS CodeBuild

### Build on Graviton (ARM64)

```yaml
version: 0.2

phases:
  pre_build:
    commands:
      - echo "Logging in to Amazon ECR..."
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $REPOSITORY_URI
      - COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)
      - IMAGE_TAG=${COMMIT_HASH:=latest}

  build:
    commands:
      - echo "Building ARM64 Docker image..."
      - docker build -t $REPOSITORY_URI:arm64-$IMAGE_TAG .
      - docker tag $REPOSITORY_URI:arm64-$IMAGE_TAG $REPOSITORY_URI:arm64-latest

  post_build:
    commands:
      - echo "Pushing ARM64 image to ECR..."
      - docker push $REPOSITORY_URI:arm64-$IMAGE_TAG
      - docker push $REPOSITORY_URI:arm64-latest
      - echo "Build completed on $(uname -m) architecture"

artifacts:
  files:
    - '**/*'

# Use ARM64 build environment for native builds
environment:
  type: ARM_CONTAINER
  image: aws/codebuild/amazonlinux2-aarch64-standard:3.0
  compute-type: BUILD_GENERAL1_SMALL  # or LARGE for faster builds
  privileged-mode: true
```

### Multi-Architecture Build with CodeBuild

Build both architectures and create manifest:

```yaml
version: 0.2

phases:
  pre_build:
    commands:
      - echo "Setting up multi-architecture build..."
      - docker buildx create --use --name multiarch-builder
      - docker buildx inspect --bootstrap
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $REPOSITORY_URI

  build:
    commands:
      - echo "Building multi-architecture image..."
      - |
        docker buildx build \
          --platform linux/arm64,linux/amd64 \
          -t $REPOSITORY_URI:$CODEBUILD_RESOLVED_SOURCE_VERSION \
          -t $REPOSITORY_URI:latest \
          --push \
          .

  post_build:
    commands:
      - echo "Multi-architecture build completed"
      - docker buildx imagetools inspect $REPOSITORY_URI:latest

environment:
  type: LINUX_CONTAINER
  image: aws/codebuild/standard:7.0
  compute-type: BUILD_GENERAL1_LARGE
  privileged-mode: true
```

## AWS CodePipeline

### Complete Pipeline with Multi-Stage Deployment

```yaml
# codepipeline-config.yaml
version: 1

Resources:
  BuildProject:
    Type: AWS::CodeBuild::Project
    Properties:
      Name: graviton-demo-build
      Environment:
        Type: ARM_CONTAINER
        Image: aws/codebuild/amazonlinux2-aarch64-standard:3.0
        ComputeType: BUILD_GENERAL1_SMALL
        PrivilegedMode: true
      Source:
        Type: GITHUB
        Location: https://github.com/your-org/graviton-demo
      Artifacts:
        Type: NO_ARTIFACTS

  Pipeline:
    Type: AWS::CodePipeline::Pipeline
    Properties:
      Name: graviton-demo-pipeline
      Stages:
        - Name: Source
          Actions:
            - Name: SourceAction
              ActionTypeId:
                Category: Source
                Owner: ThirdParty
                Provider: GitHub
                Version: 1

        - Name: Build
          Actions:
            - Name: BuildARM64
              ActionTypeId:
                Category: Build
                Owner: AWS
                Provider: CodeBuild
                Version: 1
              Configuration:
                ProjectName: !Ref BuildProject

        - Name: DeployToStaging
          Actions:
            - Name: DeployStaging
              ActionTypeId:
                Category: Deploy
                Owner: AWS
                Provider: ECS
                Version: 1
              Configuration:
                ClusterName: staging-graviton-cluster
                ServiceName: graviton-demo-staging

        - Name: ManualApproval
          Actions:
            - Name: ApproveProduction
              ActionTypeId:
                Category: Approval
                Owner: AWS
                Provider: Manual
                Version: 1

        - Name: DeployToProduction
          Actions:
            - Name: DeployProduction
              ActionTypeId:
                Category: Deploy
                Owner: AWS
                Provider: ECS
                Version: 1
              Configuration:
                ClusterName: production-graviton-cluster
                ServiceName: graviton-demo-production
```

## GitLab CI/CD

### Multi-Architecture Build

```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - deploy

variables:
  DOCKER_HOST: tcp://docker:2375
  DOCKER_TLS_CERTDIR: ""
  IMAGE_NAME: $CI_REGISTRY_IMAGE

build-multiarch:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker buildx create --use --name multiarch
    - docker buildx inspect --bootstrap
  script:
    - |
      docker buildx build \
        --platform linux/arm64,linux/amd64 \
        -t $IMAGE_NAME:$CI_COMMIT_SHA \
        -t $IMAGE_NAME:latest \
        --push \
        .
  only:
    - main
    - develop

test-arm64:
  stage: test
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker run --rm --platform linux/arm64 $IMAGE_NAME:$CI_COMMIT_SHA java -version
    - docker run --rm -d --platform linux/arm64 -p 8080:8080 $IMAGE_NAME:$CI_COMMIT_SHA
    - sleep 30
    - docker run --rm --network host curlimages/curl:latest curl http://localhost:8080/actuator/health
  dependencies:
    - build-multiarch

deploy-ecs:
  stage: deploy
  image: amazon/aws-cli
  script:
    - aws ecs update-service --cluster graviton-cluster --service graviton-demo --force-new-deployment
  only:
    - main
  when: manual
```

## Jenkins

### Declarative Pipeline for Multi-Architecture

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    environment {
        REGISTRY = 'your-registry.com'
        IMAGE_NAME = 'graviton-demo'
        AWS_REGION = 'us-east-1'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Setup Buildx') {
            steps {
                sh '''
                    docker buildx create --use --name multiarch-builder || true
                    docker buildx inspect --bootstrap
                '''
            }
        }
        
        stage('Build Multi-Arch Image') {
            steps {
                sh '''
                    docker buildx build \
                        --platform linux/arm64,linux/amd64 \
                        -t ${REGISTRY}/${IMAGE_NAME}:${BUILD_NUMBER} \
                        -t ${REGISTRY}/${IMAGE_NAME}:latest \
                        --push \
                        .
                '''
            }
        }
        
        stage('Test ARM64') {
            steps {
                sh '''
                    docker run --rm --platform linux/arm64 \
                        ${REGISTRY}/${IMAGE_NAME}:${BUILD_NUMBER} \
                        java -version
                '''
            }
        }
        
        stage('Test x86') {
            steps {
                sh '''
                    docker run --rm --platform linux/amd64 \
                        ${REGISTRY}/${IMAGE_NAME}:${BUILD_NUMBER} \
                        java -version
                '''
            }
        }
        
        stage('Deploy to Staging') {
            when {
                branch 'develop'
            }
            steps {
                sh '''
                    aws ecs update-service \
                        --cluster staging-cluster \
                        --service ${IMAGE_NAME}-staging \
                        --force-new-deployment \
                        --region ${AWS_REGION}
                '''
            }
        }
        
        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                input message: 'Deploy to Production?', ok: 'Deploy'
                sh '''
                    aws ecs update-service \
                        --cluster production-cluster \
                        --service ${IMAGE_NAME}-production \
                        --force-new-deployment \
                        --region ${AWS_REGION}
                '''
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
    }
}
```

## CircleCI

### Multi-Architecture Build Configuration

```yaml
# .circleci/config.yml
version: 2.1

executors:
  docker-publisher:
    environment:
      IMAGE_NAME: graviton-demo
    docker:
      - image: cimg/base:stable

jobs:
  build-and-push:
    executor: docker-publisher
    steps:
      - checkout
      - setup_remote_docker:
          version: 20.10.14

      - run:
          name: Setup Buildx
          command: |
            docker buildx create --use --name multiarch
            docker buildx inspect --bootstrap

      - run:
          name: Build multi-arch image
          command: |
            docker buildx build \
              --platform linux/arm64,linux/amd64 \
              -t ${DOCKER_REGISTRY}/${IMAGE_NAME}:${CIRCLE_SHA1} \
              -t ${DOCKER_REGISTRY}/${IMAGE_NAME}:latest \
              --push \
              .

      - run:
          name: Test ARM64 image
          command: |
            docker run --rm --platform linux/arm64 \
              ${DOCKER_REGISTRY}/${IMAGE_NAME}:${CIRCLE_SHA1} \
              java -version

workflows:
  version: 2
  build-deploy:
    jobs:
      - build-and-push:
          context: docker-hub
          filters:
            branches:
              only:
                - main
                - develop
```

## Best Practices

### 1. Use BuildKit and Buildx
```bash
# Enable BuildKit for better caching
export DOCKER_BUILDKIT=1

# Use buildx for multi-arch
docker buildx build --platform linux/arm64,linux/amd64 ...
```

### 2. Cache Optimization
```yaml
# GitHub Actions
- uses: docker/build-push-action@v4
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### 3. Separate Build and Push Stages
```bash
# Build only (for testing)
docker buildx build --platform linux/arm64,linux/amd64 -t image:tag .

# Build and push (for deployment)
docker buildx build --platform linux/arm64,linux/amd64 -t image:tag --push .
```

### 4. Use Native Builders When Possible
- ARM64 builds on Graviton instances (faster, more accurate)
- x86 builds on x86 instances
- Create manifest to combine both

### 5. Tag Strategy
```bash
# Semantic versioning
-t myapp:1.2.3
-t myapp:1.2
-t myapp:1
-t myapp:latest

# Git-based
-t myapp:commit-abc1234
-t myapp:branch-main

# Architecture-specific (for debugging)
-t myapp:1.2.3-arm64
-t myapp:1.2.3-amd64
```

## Troubleshooting

### Issue: "multiple platforms feature is currently not supported"
**Solution**: Create and use buildx builder:
```bash
docker buildx create --name multiarch --use
docker buildx inspect --bootstrap
```

### Issue: Slow builds with QEMU
**Solution**: Use native builders or accept longer build times for cross-compilation

### Issue: Different behavior between architectures
**Solution**: Test both architectures in CI/CD:
```bash
docker run --platform linux/arm64 myapp:test ./run-tests.sh
docker run --platform linux/amd64 myapp:test ./run-tests.sh
```

## Security Considerations

### 1. Image Scanning
```bash
# Scan both architectures
docker scan --platform linux/arm64 myapp:latest
docker scan --platform linux/amd64 myapp:latest
```

### 2. Sign Images
```bash
# Use Docker Content Trust
export DOCKER_CONTENT_TRUST=1
docker push myapp:latest
```

### 3. Least Privilege
- Use minimal base images
- Run as non-root user
- Scan dependencies regularly

## Monitoring Deployments

### Track Architecture Distribution

```bash
# Query ECS tasks by architecture
aws ecs list-tasks --cluster graviton-cluster | \
  xargs -I {} aws ecs describe-tasks --cluster graviton-cluster --tasks {} | \
  jq '.tasks[].containers[].runtimePlatform.cpuArchitecture'
```

### Monitor Performance by Architecture

Set up CloudWatch metrics to compare:
- Response times by architecture
- Resource utilization (CPU, memory)
- Cost per request

## Summary

Multi-architecture CI/CD pipelines enable:
- Single codebase for multiple architectures
- Automated testing on both ARM64 and x86
- Simplified deployment across mixed infrastructure
- Cost optimization with Graviton instances

Choose the CI/CD approach that best fits your organization:
- **GitHub Actions**: Excellent for open-source projects
- **AWS CodeBuild/Pipeline**: Best for AWS-native applications
- **GitLab CI/CD**: Integrated solution for GitLab users
- **Jenkins**: Flexible for complex enterprise workflows
- **CircleCI**: Fast builds with good caching

All approaches support building multi-architecture images for AWS Graviton deployment.
