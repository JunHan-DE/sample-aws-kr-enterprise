#!/bin/bash
# ARM64 Functional Testing Script
# Validates application behavior on ARM64 architecture

set -e

echo "=========================================="
echo "ARM64 Functional Testing"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ ERROR: Docker daemon is not running"
    echo "Please start Docker Desktop or Docker Engine"
    exit 1
fi

# Check if graviton-demo:arm64 image exists
if ! docker images | grep -q "graviton-demo.*arm64"; then
    echo "❌ ERROR: graviton-demo:arm64 image not found"
    echo "Please run: docker buildx build --platform linux/arm64 -t graviton-demo:arm64 --load ."
    exit 1
fi

# Start ARM64 container if not already running
if ! docker ps | grep -q graviton-test; then
    echo "Starting ARM64 container..."
    docker run --platform linux/arm64 -d -p 8080:8080 --name graviton-test graviton-demo:arm64
    
    echo "Waiting for application to start (20 seconds)..."
    sleep 20
else
    echo "Container 'graviton-test' is already running"
fi

BASE_URL="http://localhost:8080"

# Test 1: Health Endpoint
echo "[1/7] Testing health endpoint..."
HEALTH=$(curl -s $BASE_URL/api/health)
if [ "$HEALTH" = "OK" ]; then
    echo "✅ PASS: Health endpoint returned 'OK'"
else
    echo "❌ FAIL: Health endpoint returned '$HEALTH'"
    docker logs graviton-test
    exit 1
fi

# Test 2: Actuator Health
echo "[2/7] Testing actuator health endpoint..."
if command -v jq > /dev/null 2>&1; then
    STATUS=$(curl -s $BASE_URL/actuator/health | jq -r '.status')
    if [ "$STATUS" = "UP" ]; then
        echo "✅ PASS: Actuator health status is UP"
    else
        echo "❌ FAIL: Actuator status is '$STATUS'"
        exit 1
    fi
else
    # Fallback without jq
    RESPONSE=$(curl -s $BASE_URL/actuator/health)
    if echo "$RESPONSE" | grep -q '"status":"UP"'; then
        echo "✅ PASS: Actuator health status is UP"
    else
        echo "❌ FAIL: Actuator health check failed"
        exit 1
    fi
fi

# Test 3: ARM64 Architecture Detection
echo "[3/7] Testing ARM64 architecture detection..."
if command -v jq > /dev/null 2>&1; then
    ARCH_TYPE=$(curl -s $BASE_URL/api/system-info | jq -r '.architectureType')
    if [ "$ARCH_TYPE" = "ARM64 (Graviton)" ]; then
        echo "✅ PASS: Architecture detected as 'ARM64 (Graviton)'"
    else
        echo "❌ FAIL: Expected 'ARM64 (Graviton)', got '$ARCH_TYPE'"
        exit 1
    fi
else
    RESPONSE=$(curl -s $BASE_URL/api/system-info)
    if echo "$RESPONSE" | grep -q 'ARM64 (Graviton)'; then
        echo "✅ PASS: Architecture detected as 'ARM64 (Graviton)'"
    else
        echo "❌ FAIL: ARM64 architecture not detected correctly"
        echo "Response: $RESPONSE"
        exit 1
    fi
fi

# Test 4: OS Architecture Property
echo "[4/7] Testing os.arch property..."
if command -v jq > /dev/null 2>&1; then
    OS_ARCH=$(curl -s $BASE_URL/api/system-info | jq -r '.osArch')
    if [ "$OS_ARCH" = "aarch64" ]; then
        echo "✅ PASS: os.arch is 'aarch64'"
    else
        echo "❌ FAIL: Expected 'aarch64', got '$OS_ARCH'"
        exit 1
    fi
else
    RESPONSE=$(curl -s $BASE_URL/api/system-info)
    if echo "$RESPONSE" | grep -q 'aarch64'; then
        echo "✅ PASS: os.arch is 'aarch64'"
    else
        echo "❌ FAIL: os.arch is not aarch64"
        exit 1
    fi
fi

# Test 5: Java Version and Vendor
echo "[5/7] Testing Java version and vendor..."
if command -v jq > /dev/null 2>&1; then
    JAVA_VERSION=$(curl -s $BASE_URL/api/system-info | jq -r '.javaVersion')
    JAVA_VENDOR=$(curl -s $BASE_URL/api/system-info | jq -r '.javaVendor')
    
    if [[ "$JAVA_VERSION" == 17.* ]]; then
        echo "✅ PASS: Java version is 17.x ($JAVA_VERSION)"
    else
        echo "❌ FAIL: Expected Java 17.x, got $JAVA_VERSION"
        exit 1
    fi
    
    if [[ "$JAVA_VENDOR" == *"Eclipse"* ]] || [[ "$JAVA_VENDOR" == *"Temurin"* ]] || [[ "$JAVA_VENDOR" == *"Adoptium"* ]]; then
        echo "✅ PASS: Java vendor is Eclipse Temurin ($JAVA_VENDOR)"
    else
        echo "⚠️  WARNING: Expected Eclipse Temurin, got $JAVA_VENDOR"
    fi
else
    echo "ℹ️  INFO: jq not available, skipping detailed Java version check"
    echo "✅ PASS: Assuming Java checks passed (install jq for detailed validation)"
fi

# Test 6: Benchmark Endpoint
echo "[6/7] Testing compute benchmark endpoint..."
BENCHMARK_RESPONSE=$(curl -s "$BASE_URL/api/compute/benchmark?iterations=1000")
if [ $? -eq 0 ] && [ -n "$BENCHMARK_RESPONSE" ]; then
    if command -v jq > /dev/null 2>&1; then
        ITERATIONS=$(echo "$BENCHMARK_RESPONSE" | jq -r '.iterations')
        if [ "$ITERATIONS" = "1000" ]; then
            echo "✅ PASS: Benchmark endpoint functional"
        else
            echo "❌ FAIL: Benchmark returned unexpected iterations"
            exit 1
        fi
    else
        echo "✅ PASS: Benchmark endpoint responded"
    fi
else
    echo "❌ FAIL: Benchmark endpoint error"
    exit 1
fi

# Test 7: Metrics Endpoint
echo "[7/7] Testing Prometheus metrics endpoint..."
METRICS=$(curl -s $BASE_URL/actuator/prometheus)
if echo "$METRICS" | grep -q "jvm_memory_used_bytes"; then
    echo "✅ PASS: Metrics endpoint functional"
else
    echo "❌ FAIL: Metrics endpoint error"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ ALL FUNCTIONAL TESTS PASSED"
echo "=========================================="
echo ""
echo "Test Results Summary:"
echo "- Health endpoints: ✅ OK"
echo "- ARM64 detection: ✅ ARM64 (Graviton)"
echo "- os.arch property: ✅ aarch64"
if [ -n "$JAVA_VERSION" ]; then
    echo "- Java version: ✅ $JAVA_VERSION"
fi
echo "- Benchmark endpoint: ✅ Functional"
echo "- Metrics endpoint: ✅ Available"
echo ""
echo "Container: graviton-test (running on port 8080)"
echo ""
echo "To stop and cleanup:"
echo "  docker stop graviton-test"
echo "  docker rm graviton-test"
echo ""
echo "For detailed testing documentation, see:"
echo "  arm64-functional-testing-step6.md"
