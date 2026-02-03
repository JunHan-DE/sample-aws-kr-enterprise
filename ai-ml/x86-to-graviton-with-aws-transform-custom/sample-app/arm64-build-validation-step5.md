# ARM64 Build Validation and Container Image Testing - Step 5

## Overview
This document provides comprehensive guidance for building and testing the application on ARM64 architecture using Docker multi-architecture support. It includes validation procedures, expected outputs, and troubleshooting guidance.

## Prerequisites

### Docker Requirements
- Docker Desktop 20.10+ (includes buildx)
- Docker Engine with buildx plugin installed
- Docker daemon must be running
- Multi-architecture support enabled

### System Requirements
- **For ARM64 testing**: AWS Graviton EC2 instance OR ARM64 local system (Apple Silicon Mac, ARM64 Linux)
- **For x86 testing**: Standard x86/amd64 system
- Sufficient disk space for container images (~500MB per image)

## Verification Commands

### Check Docker Installation
```bash
# Verify Docker is installed
docker --version
# Expected: Docker version 20.10.0 or higher

# Verify buildx is available
docker buildx version
# Expected: github.com/docker/buildx v0.x.x

# Check buildx builder status
docker buildx ls
# Expected: At least one builder with RUNNING status
```

### Create Multi-Architecture Builder (if needed)
```bash
# Create new builder instance
docker buildx create --name multiarch-builder --use

# Bootstrap the builder
docker buildx inspect --bootstrap

# Verify builder supports multiple platforms
docker buildx inspect
# Expected platforms: linux/amd64, linux/arm64, linux/arm/v7, etc.
```

## ARM64 Build Validation

### Step 1: Build ARM64 Container Image

```bash
# Build for ARM64/linux platform
docker buildx build --platform linux/arm64 -t graviton-demo:arm64 --load .

# Expected output indicators:
# - "=> [linux/arm64 1/X] FROM eclipse-temurin:17-jre"
# - Build completes without errors
# - Image loaded successfully
```

**Important Notes**:
- `--load` flag loads image into local Docker (required for single-platform builds)
- Building on x86 will use QEMU emulation (slower but functional)
- Building on ARM64 native system is faster and preferred for validation

### Step 2: Verify Image Architecture

```bash
# Inspect image architecture
docker image inspect graviton-demo:arm64 | grep -i architecture
# Expected: "Architecture": "arm64"

# Alternative: Use docker inspect with format
docker inspect --format='{{.Architecture}}' graviton-demo:arm64
# Expected output: arm64
```

### Step 3: Validate Java Version and JDK Distribution

```bash
# Check Java version in ARM64 container
docker run --platform linux/arm64 graviton-demo:arm64 java -version

# Expected output should include:
# - "Eclipse Temurin" (JDK distribution)
# - "openjdk version \"17.x.x\"" (Java version)
# - "OpenJDK Runtime Environment Temurin-17" (runtime)
# - "OpenJDK 64-Bit Server VM Temurin-17" (VM)
```

**Verification Checklist**:
- ✅ JDK distribution is Eclipse Temurin (not changed)
- ✅ Java version is 17.x.x (correct version)
- ✅ No warnings or errors during version check

### Step 4: Verify ARM64 Architecture Detection

```bash
# Check os.arch system property
docker run --platform linux/arm64 graviton-demo:arm64 \
  java -XshowSettings:properties -version 2>&1 | grep "os.arch"

# Expected output:
# os.arch = aarch64
```

**Note**: The JVM reports ARM64 as "aarch64" (standard Linux/Unix name)

### Step 5: Test Application Startup on ARM64

```bash
# Start application in detached mode
docker run --platform linux/arm64 -d -p 8080:8080 --name graviton-test graviton-demo:arm64

# Expected: Container ID printed (long hash)
# Example: a3f5d8b2c1e9...
```

### Step 6: Verify JVM Flags Accepted Without Errors

```bash
# Check container logs for JVM initialization
docker logs graviton-test 2>&1 | head -20

# Verify JVM flags are accepted:
# Look for startup without errors
# Check for Spring Boot banner
# Verify "Started DemoApplication in X seconds"
```

**Expected Log Indicators**:
- No errors about unrecognized JVM options
- Spring Boot starts successfully
- Application context loads without exceptions
- Tomcat starts on port 8080

**Graviton-Optimized Flags Being Applied**:
```
-XX:+UseContainerSupport
-XX:MaxRAMPercentage=75.0
-XX:InitialRAMPercentage=50.0
-XX:+UseG1GC
-XX:+UseStringDeduplication
-XX:-TieredCompilation
-XX:ReservedCodeCacheSize=64M
-XX:InitialCodeCacheSize=64M
-XX:CICompilerCount=2
-XX:CompilationMode=high-only
```

### Step 7: Test Health Endpoint

```bash
# Wait for application to be ready (10-30 seconds)
sleep 15

# Test health endpoint
curl -s http://localhost:8080/actuator/health | jq

# Expected response:
# {
#   "status": "UP"
# }
```

**If curl/jq not available**:
```bash
# Alternative without jq
curl -s http://localhost:8080/actuator/health

# Or check from within container
docker exec graviton-test curl -s http://localhost:8080/actuator/health
```

### Step 8: Validate SystemInfoService ARM64 Detection

```bash
# Test system info endpoint
curl -s http://localhost:8080/api/system-info | jq

# Expected response includes:
# {
#   "osName": "Linux",
#   "osArch": "aarch64",
#   "architectureType": "ARM64 (Graviton)",
#   "javaVersion": "17.x.x",
#   "javaVendor": "Eclipse Adoptium",
#   ...
# }
```

**Validation Points**:
- ✅ `osArch` is "aarch64"
- ✅ `architectureType` is "ARM64 (Graviton)"
- ✅ `javaVersion` starts with "17"
- ✅ `javaVendor` includes "Eclipse Adoptium" or "Temurin"

### Step 9: Cleanup ARM64 Test Container

```bash
# Stop and remove test container
docker stop graviton-test
docker rm graviton-test
```

## x86 Build Validation (Comparison)

### Step 1: Build x86/AMD64 Container Image

```bash
# Build for x86/amd64 platform
docker buildx build --platform linux/amd64 -t graviton-demo:amd64 --load .

# Expected output:
# - "=> [linux/amd64 1/X] FROM eclipse-temurin:17-jre"
# - Build completes successfully
```

### Step 2: Verify x86 Architecture

```bash
# Inspect x86 image architecture
docker inspect --format='{{.Architecture}}' graviton-demo:amd64
# Expected output: amd64
```

### Step 3: Test x86 Application Startup

```bash
# Start x86 container
docker run --platform linux/amd64 -d -p 8081:8080 --name graviton-test-x86 graviton-demo:amd64

# Wait and test health
sleep 15
curl -s http://localhost:8081/actuator/health | jq

# Test system info
curl -s http://localhost:8081/api/system-info | jq

# Cleanup
docker stop graviton-test-x86
docker rm graviton-test-x86
```

**Expected x86 Output**:
- `osArch`: "amd64" or "x86_64"
- `architectureType`: "x86_64 (Intel/AMD)"
- Same Java version and vendor as ARM64 build

## Multi-Architecture Build (Both Platforms)

### Build for Both ARM64 and x86 Simultaneously

```bash
# Build multi-arch image (requires push to registry or --load with single platform)
docker buildx build --platform linux/arm64,linux/amd64 -t graviton-demo:latest .

# To push to registry (if available):
# docker buildx build --platform linux/arm64,linux/amd64 \
#   -t myregistry.example.com/graviton-demo:latest --push .
```

**Note**: Multi-platform builds cannot use `--load` flag. Images must be pushed to a registry or built individually with `--load`.

## Build Validation Checklist

### ARM64 Build Requirements
- ✅ Container image builds successfully for linux/arm64 platform
- ✅ Image architecture verified as "arm64"
- ✅ Java version shows Eclipse Temurin 17
- ✅ os.arch property shows "aarch64"
- ✅ Application starts without errors on ARM64
- ✅ Graviton-optimized JVM flags accepted without errors
- ✅ Health endpoint responds successfully
- ✅ SystemInfoService correctly reports "ARM64 (Graviton)"

### x86 Build Requirements
- ✅ Container image builds successfully for linux/amd64 platform
- ✅ Image architecture verified as "amd64"
- ✅ Java version shows Eclipse Temurin 17
- ✅ os.arch property shows "amd64" or "x86_64"
- ✅ Application starts without errors on x86
- ✅ JVM flags work correctly on x86 (same flags as ARM64)

### Multi-Architecture Validation
- ✅ Both ARM64 and x86 images build from same Dockerfile
- ✅ No architecture-specific code paths required
- ✅ Same Eclipse Temurin 17 base image for both platforms
- ✅ Same JVM flags work on both platforms
- ✅ Application behavior consistent across architectures

## Troubleshooting

### Issue: Docker daemon not running
```bash
# Error: Cannot connect to the Docker daemon
# Solution: Start Docker Desktop or Docker Engine service

# macOS/Windows: Start Docker Desktop application
# Linux: sudo systemctl start docker
```

### Issue: buildx not available
```bash
# Error: docker buildx: command not found
# Solution: Update Docker to version 20.10+ or install buildx plugin

# Check Docker version
docker --version

# Update Docker Desktop or install buildx
# https://docs.docker.com/buildx/working-with-buildx/
```

### Issue: Platform not supported
```bash
# Error: multiple platforms feature is currently not supported for docker driver
# Solution: Create multiarch builder

docker buildx create --name multiarch-builder --use
docker buildx inspect --bootstrap
```

### Issue: QEMU emulation slow on x86
```bash
# Symptom: ARM64 build on x86 is very slow (30+ minutes)
# Solution: This is normal for cross-platform builds with emulation
# Recommendation: Use native ARM64 system for faster builds (AWS Graviton EC2)

# To speed up on x86: Use Docker Desktop with Rosetta (macOS) or enable QEMU
# https://docs.docker.com/desktop/settings/mac/#use-rosetta-for-x86-amd64-emulation-on-apple-silicon
```

### Issue: Application fails to start
```bash
# Check logs for errors
docker logs graviton-test

# Common issues:
# - Port 8080 already in use: Change to different port (-p 8081:8080)
# - Memory issues: Increase Docker memory limit
# - JVM flag errors: Check Dockerfile JAVA_OPTS syntax
```

### Issue: JVM flags not recognized
```bash
# Error: Unrecognized VM option 'CompilationMode'
# Cause: JVM flag not available in current Java version
# Solution: Verify Java 17 is being used (flag requires Java 17+)

docker run --platform linux/arm64 graviton-demo:arm64 java -version
```

## Performance Notes

### Build Time Comparison
- **Native ARM64 build** (on Graviton): 3-5 minutes
- **Cross-platform ARM64 build** (on x86 with QEMU): 15-30 minutes
- **Native x86 build**: 2-4 minutes

### Recommendation
For production CI/CD pipelines, use:
- ARM64 builders for ARM64 images (faster, more accurate)
- x86 builders for x86 images
- Parallel builds for both architectures

## Docker Compose Support

Example docker-compose.yml with platform specification:
```yaml
version: '3.8'
services:
  app:
    image: graviton-demo:latest
    platform: linux/arm64  # or linux/amd64
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=prod
```

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Set up QEMU
  uses: docker/setup-qemu-action@v2

- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v2

- name: Build multi-arch image
  run: |
    docker buildx build \
      --platform linux/arm64,linux/amd64 \
      -t graviton-demo:${{ github.sha }} \
      --push .
```

### AWS CodeBuild Example
```yaml
phases:
  build:
    commands:
      - docker buildx create --use
      - docker buildx build --platform linux/arm64 -t graviton-demo:latest --load .
      - docker push graviton-demo:latest
```

## Validation Summary

This step validates that:
1. ✅ Application builds successfully on ARM64 architecture
2. ✅ Eclipse Temurin 17 JDK is preserved (no distribution changes)
3. ✅ ARM64 architecture is correctly detected by JVM
4. ✅ Graviton-optimized JVM flags are accepted without errors
5. ✅ Application starts and runs correctly on ARM64
6. ✅ Health and system info endpoints work properly
7. ✅ Same Dockerfile produces working images for both ARM64 and x86
8. ✅ Multi-architecture deployment is ready for production

## Next Steps

After successful build validation:
- **Step 6**: Functional Testing on ARM64 Architecture (run test suite)
- **Step 7**: Performance and Stability Validation (load testing, metrics)
- **Step 8**: Documentation and CI/CD configuration

## Deployment Readiness

At this point, the application is ready for:
- AWS Graviton EC2 deployment (c7g, m7g, r7g instances)
- AWS ECS on Graviton (Fargate with ARM64)
- Amazon EKS with Graviton node groups
- Multi-architecture Kubernetes deployments

The container images are validated and production-ready for ARM64 deployment.
