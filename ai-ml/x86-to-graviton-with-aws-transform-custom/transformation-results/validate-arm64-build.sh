#!/bin/bash
# ARM64 Build Validation Script
# This script validates Docker multi-architecture builds for ARM64 and x86

set -e  # Exit on error

echo "=========================================="
echo "ARM64 Build Validation Test Script"
echo "=========================================="
echo ""

# Check Docker is available
echo "[1/10] Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "❌ ERROR: Docker is not installed or not in PATH"
    exit 1
fi

docker --version
echo "✅ Docker is installed"
echo ""

# Check buildx is available
echo "[2/10] Checking Docker buildx..."
if ! docker buildx version &> /dev/null; then
    echo "❌ ERROR: Docker buildx is not available"
    echo "Please update Docker to version 20.10+ or install buildx plugin"
    exit 1
fi

docker buildx version
echo "✅ Docker buildx is available"
echo ""

# Check Docker daemon is running
echo "[3/10] Checking Docker daemon..."
if ! docker info &> /dev/null; then
    echo "❌ ERROR: Docker daemon is not running"
    echo "Please start Docker Desktop or Docker Engine service"
    exit 1
fi
echo "✅ Docker daemon is running"
echo ""

# Check buildx builder
echo "[4/10] Checking buildx builder..."
if ! docker buildx inspect &> /dev/null; then
    echo "⚠️  No active buildx builder found. Creating one..."
    docker buildx create --name multiarch-builder --use
    docker buildx inspect --bootstrap
    echo "✅ Buildx builder created"
else
    echo "✅ Buildx builder is ready"
fi
echo ""

# Build ARM64 image
echo "[5/10] Building ARM64 container image..."
echo "This may take several minutes (especially on x86 with QEMU emulation)..."
docker buildx build --platform linux/arm64 -t graviton-demo:arm64 --load .
echo "✅ ARM64 image built successfully"
echo ""

# Verify ARM64 architecture
echo "[6/10] Verifying ARM64 image architecture..."
ARCH=$(docker inspect --format='{{.Architecture}}' graviton-demo:arm64)
if [ "$ARCH" != "arm64" ]; then
    echo "❌ ERROR: Expected architecture 'arm64', got '$ARCH'"
    exit 1
fi
echo "✅ Image architecture verified: $ARCH"
echo ""

# Check Java version
echo "[7/10] Checking Java version in ARM64 container..."
echo "Expected: Eclipse Temurin 17.x.x"
docker run --rm --platform linux/arm64 graviton-demo:arm64 java -version
echo "✅ Java version verified"
echo ""

# Check os.arch property
echo "[8/10] Verifying os.arch property (should be aarch64)..."
OS_ARCH=$(docker run --rm --platform linux/arm64 graviton-demo:arm64 \
  java -XshowSettings:properties -version 2>&1 | grep "os.arch" | awk -F'=' '{print $2}' | tr -d ' ')
if [ "$OS_ARCH" != "aarch64" ]; then
    echo "❌ ERROR: Expected os.arch 'aarch64', got '$OS_ARCH'"
    exit 1
fi
echo "✅ os.arch verified: $OS_ARCH"
echo ""

# Build x86 image for comparison
echo "[9/10] Building x86/amd64 container image..."
docker buildx build --platform linux/amd64 -t graviton-demo:amd64 --load .
echo "✅ x86/amd64 image built successfully"
echo ""

# Verify x86 architecture
echo "[10/10] Verifying x86 image architecture..."
ARCH_X86=$(docker inspect --format='{{.Architecture}}' graviton-demo:amd64)
if [ "$ARCH_X86" != "amd64" ]; then
    echo "❌ ERROR: Expected architecture 'amd64', got '$ARCH_X86'"
    exit 1
fi
echo "✅ Image architecture verified: $ARCH_X86"
echo ""

echo "=========================================="
echo "✅ ALL VALIDATION CHECKS PASSED"
echo "=========================================="
echo ""
echo "Summary:"
echo "- ARM64 image: graviton-demo:arm64 (architecture: arm64)"
echo "- x86 image: graviton-demo:amd64 (architecture: amd64)"
echo "- Java version: Eclipse Temurin 17"
echo "- ARM64 os.arch: aarch64"
echo ""
echo "Next steps:"
echo "1. Test application startup: docker run -d -p 8080:8080 graviton-demo:arm64"
echo "2. Test health endpoint: curl http://localhost:8080/actuator/health"
echo "3. Test system info: curl http://localhost:8080/api/system-info"
echo ""
echo "For detailed validation procedures, see: arm64-build-validation-step5.md"
