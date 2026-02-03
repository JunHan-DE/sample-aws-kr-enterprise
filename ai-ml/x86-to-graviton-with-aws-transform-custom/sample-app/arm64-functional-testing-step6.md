# Functional Testing on ARM64 Architecture - Step 6

## Overview
This document provides comprehensive guidance for executing the complete test suite on ARM64 architecture to verify application behavior and identify any architecture-specific issues.

## Test Suite Overview

### Existing Tests
The application includes the following test classes:
- `DemoApplicationTests.java`: Main test suite with 5 tests

### Test Coverage
1. **Context Loading**: Verifies Spring Boot application context loads successfully
2. **Health Endpoint**: Tests /api/health endpoint returns OK status
3. **System Info Endpoint**: Validates /api/system-info returns architecture data
4. **Architecture Detection**: Verifies SystemInfoService detects architecture correctly
5. **Benchmark Endpoint**: Tests /api/compute/benchmark functionality

## Test Execution Methods

### Method 1: Test in ARM64 Container (Build Stage)

```bash
# Use the Maven build stage which includes test execution
docker buildx build --platform linux/arm64 -t graviton-demo:arm64-test \
  --target builder \
  --build-arg MAVEN_OPTS="-Dmaven.test.skip=false" \
  .

# Note: The default Dockerfile skips tests (-DskipTests)
# For testing, modify the build stage temporarily
```

### Method 2: Test on ARM64 Host System

If running on an ARM64 system (AWS Graviton EC2, Apple Silicon Mac):

```bash
# Run tests with Maven
mvn clean test

# Or with specific test
mvn test -Dtest=DemoApplicationTests

# With verbose output
mvn test -X
```

### Method 3: Test in Running ARM64 Container

```bash
# Start ARM64 container
docker run --platform linux/arm64 -d -p 8080:8080 \
  --name graviton-functional-test graviton-demo:arm64

# Wait for application to start
sleep 15

# Run functional tests via API calls (see Manual API Testing section)
```

## Expected Test Results

### On ARM64 Architecture

#### Test 1: contextLoads()
```
Expected: PASS
Duration: ~1-2 seconds
Verification: Spring Boot context loads without errors
```

#### Test 2: healthEndpointReturnsOk()
```
Expected: PASS
Request: GET /api/health
Response: "OK"
Status Code: 200
```

#### Test 3: systemInfoEndpointReturnsArchitecture()
```
Expected: PASS
Request: GET /api/system-info
Response Body (ARM64):
{
  "osName": "Linux",
  "osArch": "aarch64",
  "osVersion": "...",
  "javaVersion": "17.x.x",
  "javaVendor": "Eclipse Adoptium",
  "javaVmName": "OpenJDK 64-Bit Server VM",
  "availableProcessors": N,
  "maxMemory": N,
  "totalMemory": N,
  "freeMemory": N,
  "architectureType": "ARM64 (Graviton)"
}
Status Code: 200
```

**Key Assertions for ARM64**:
- ✅ osArch is "aarch64"
- ✅ architectureType is "ARM64 (Graviton)"
- ✅ javaVendor includes "Eclipse Adoptium" or "Temurin"
- ✅ javaVersion starts with "17"

#### Test 4: systemInfoServiceDetectsArchitecture()
```
Expected: PASS
Verification: SystemInfo.architectureType contains "ARM64"
Expected Value: "ARM64 (Graviton)"
```

#### Test 5: benchmarkEndpointWorks()
```
Expected: PASS
Request: GET /api/compute/benchmark?iterations=100
Response: JSON with benchmark results
Status Code: 200
Verification: Compute operations work correctly on ARM64
```

### Expected Test Summary
```
Tests run: 5
Failures: 0
Errors: 0
Skipped: 0
Success rate: 100%
Time elapsed: ~10-15 seconds
```

## Manual API Testing on ARM64

### Prerequisites
```bash
# Start ARM64 container
docker run --platform linux/arm64 -d -p 8080:8080 \
  --name graviton-test graviton-demo:arm64

# Wait for startup
sleep 15

# Verify container is running
docker ps | grep graviton-test
```

### Test 1: Health Endpoint
```bash
curl -s http://localhost:8080/api/health
# Expected: "OK"

# With response code
curl -w "\nHTTP Status: %{http_code}\n" -s http://localhost:8080/api/health
# Expected: HTTP Status: 200
```

### Test 2: Actuator Health Endpoint
```bash
curl -s http://localhost:8080/actuator/health | jq
# Expected output:
# {
#   "status": "UP"
# }
```

### Test 3: System Info Endpoint (Critical ARM64 Validation)
```bash
curl -s http://localhost:8080/api/system-info | jq
```

**Expected Output on ARM64**:
```json
{
  "osName": "Linux",
  "osArch": "aarch64",
  "osVersion": "5.x.x-xxx",
  "javaVersion": "17.0.x",
  "javaVendor": "Eclipse Adoptium",
  "javaVmName": "OpenJDK 64-Bit Server VM",
  "availableProcessors": 2,
  "maxMemory": 536870912,
  "totalMemory": 134217728,
  "freeMemory": 89478485,
  "architectureType": "ARM64 (Graviton)"
}
```

**Validation Checklist**:
- ✅ osArch = "aarch64" (not "amd64" or "x86_64")
- ✅ architectureType = "ARM64 (Graviton)" (not "x86_64 (Intel/AMD)")
- ✅ javaVendor includes "Eclipse" or "Temurin"
- ✅ javaVersion starts with "17"

### Test 4: Compute Benchmark Endpoint
```bash
# Small iteration count
curl -s "http://localhost:8080/api/compute/benchmark?iterations=1000" | jq

# Expected output includes:
# {
#   "iterations": 1000,
#   "durationMs": XX,
#   "operationsPerSecond": XXXXX,
#   "architecture": "aarch64"
# }
```

### Test 5: Prometheus Metrics Endpoint
```bash
curl -s http://localhost:8080/actuator/prometheus | head -20

# Expected: Prometheus-formatted metrics
# Should include:
# - jvm_memory_used_bytes
# - jvm_gc_pause_seconds
# - process_cpu_usage
# - system_cpu_count
```

### Test 6: JVM Metrics (Verify Graviton Optimizations)
```bash
# JVM memory metrics
curl -s http://localhost:8080/actuator/metrics/jvm.memory.used | jq

# GC pause metrics
curl -s http://localhost:8080/actuator/metrics/jvm.gc.pause | jq

# Thread count
curl -s http://localhost:8080/actuator/metrics/jvm.threads.live | jq
```

## Architecture-Specific Testing

### ARM64 Architecture Detection Test

```bash
# Verify architecture is correctly detected as ARM64
ARCH_TYPE=$(curl -s http://localhost:8080/api/system-info | jq -r '.architectureType')

if [ "$ARCH_TYPE" = "ARM64 (Graviton)" ]; then
    echo "✅ PASS: ARM64 architecture correctly detected"
else
    echo "❌ FAIL: Expected 'ARM64 (Graviton)', got '$ARCH_TYPE'"
    exit 1
fi
```

### OS Architecture Property Test

```bash
# Verify os.arch property is aarch64
OS_ARCH=$(curl -s http://localhost:8080/api/system-info | jq -r '.osArch')

if [ "$OS_ARCH" = "aarch64" ]; then
    echo "✅ PASS: os.arch is aarch64"
else
    echo "❌ FAIL: Expected 'aarch64', got '$OS_ARCH'"
    exit 1
fi
```

### Java Version and Vendor Test

```bash
# Verify Java 17 and Eclipse Temurin
JAVA_VERSION=$(curl -s http://localhost:8080/api/system-info | jq -r '.javaVersion')
JAVA_VENDOR=$(curl -s http://localhost:8080/api/system-info | jq -r '.javaVendor')

echo "Java Version: $JAVA_VERSION"
echo "Java Vendor: $JAVA_VENDOR"

if [[ "$JAVA_VERSION" == 17.* ]]; then
    echo "✅ PASS: Java 17 detected"
else
    echo "❌ FAIL: Expected Java 17.x, got $JAVA_VERSION"
fi

if [[ "$JAVA_VENDOR" == *"Eclipse"* ]] || [[ "$JAVA_VENDOR" == *"Temurin"* ]]; then
    echo "✅ PASS: Eclipse Temurin JDK confirmed"
else
    echo "❌ FAIL: Expected Eclipse Temurin, got $JAVA_VENDOR"
fi
```

## Performance Benchmark Testing on ARM64

### Basic Benchmark Test
```bash
# Run benchmark with increasing iterations
for i in 100 1000 10000; do
    echo "Testing with $i iterations..."
    curl -s "http://localhost:8080/api/compute/benchmark?iterations=$i" | jq
    echo ""
done
```

### Multi-threaded Behavior Test
```bash
# Concurrent requests to test multi-threading on ARM64
for i in {1..10}; do
    curl -s "http://localhost:8080/api/compute/benchmark?iterations=5000" > /dev/null &
done
wait

echo "✅ Multi-threaded test completed"
```

### Memory Stability Test
```bash
# Monitor memory before, during, and after load
echo "Initial memory:"
curl -s http://localhost:8080/actuator/metrics/jvm.memory.used | jq

echo "Running load test..."
for i in {1..50}; do
    curl -s "http://localhost:8080/api/compute/benchmark?iterations=10000" > /dev/null
done

echo "Final memory:"
curl -s http://localhost:8080/actuator/metrics/jvm.memory.used | jq

echo "Check for memory leaks - memory should stabilize after GC"
```

## Automated Functional Test Script

Create `test-arm64-functional.sh`:

```bash
#!/bin/bash
# ARM64 Functional Testing Script

set -e

echo "=========================================="
echo "ARM64 Functional Testing"
echo "=========================================="
echo ""

# Check if container is running
if ! docker ps | grep -q graviton-test; then
    echo "Starting ARM64 container..."
    docker run --platform linux/arm64 -d -p 8080:8080 --name graviton-test graviton-demo:arm64
    sleep 20
else
    echo "Container already running"
fi

BASE_URL="http://localhost:8080"

echo "[1/7] Testing health endpoint..."
HEALTH=$(curl -s $BASE_URL/api/health)
if [ "$HEALTH" = "OK" ]; then
    echo "✅ PASS: Health endpoint"
else
    echo "❌ FAIL: Health endpoint returned '$HEALTH'"
    exit 1
fi

echo "[2/7] Testing actuator health..."
STATUS=$(curl -s $BASE_URL/actuator/health | jq -r '.status')
if [ "$STATUS" = "UP" ]; then
    echo "✅ PASS: Actuator health"
else
    echo "❌ FAIL: Actuator status is '$STATUS'"
    exit 1
fi

echo "[3/7] Testing ARM64 architecture detection..."
ARCH_TYPE=$(curl -s $BASE_URL/api/system-info | jq -r '.architectureType')
if [ "$ARCH_TYPE" = "ARM64 (Graviton)" ]; then
    echo "✅ PASS: ARM64 architecture detected"
else
    echo "❌ FAIL: Expected 'ARM64 (Graviton)', got '$ARCH_TYPE'"
    exit 1
fi

echo "[4/7] Testing os.arch property..."
OS_ARCH=$(curl -s $BASE_URL/api/system-info | jq -r '.osArch')
if [ "$OS_ARCH" = "aarch64" ]; then
    echo "✅ PASS: os.arch is aarch64"
else
    echo "❌ FAIL: Expected 'aarch64', got '$OS_ARCH'"
    exit 1
fi

echo "[5/7] Testing Java version..."
JAVA_VERSION=$(curl -s $BASE_URL/api/system-info | jq -r '.javaVersion')
if [[ "$JAVA_VERSION" == 17.* ]]; then
    echo "✅ PASS: Java 17 ($JAVA_VERSION)"
else
    echo "❌ FAIL: Expected Java 17.x, got $JAVA_VERSION"
    exit 1
fi

echo "[6/7] Testing benchmark endpoint..."
BENCHMARK=$(curl -s "$BASE_URL/api/compute/benchmark?iterations=1000")
if echo "$BENCHMARK" | jq -e '.iterations' > /dev/null; then
    echo "✅ PASS: Benchmark endpoint"
else
    echo "❌ FAIL: Benchmark endpoint error"
    exit 1
fi

echo "[7/7] Testing metrics endpoint..."
if curl -s $BASE_URL/actuator/prometheus | grep -q "jvm_memory_used_bytes"; then
    echo "✅ PASS: Metrics endpoint"
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
echo "- Health endpoints: OK"
echo "- ARM64 detection: ARM64 (Graviton)"
echo "- os.arch: aarch64"
echo "- Java version: $JAVA_VERSION"
echo "- Benchmark: Functional"
echo "- Metrics: Available"
```

## Comparison Testing (ARM64 vs x86)

### Side-by-Side Architecture Comparison

```bash
# Start both containers
docker run --platform linux/arm64 -d -p 8080:8080 --name test-arm64 graviton-demo:arm64
docker run --platform linux/amd64 -d -p 8081:8080 --name test-x86 graviton-demo:amd64

sleep 20

# Compare architecture detection
echo "ARM64 Architecture:"
curl -s http://localhost:8080/api/system-info | jq '{osArch, architectureType, javaVersion}'

echo ""
echo "x86 Architecture:"
curl -s http://localhost:8081/api/system-info | jq '{osArch, architectureType, javaVersion}'

# Cleanup
docker stop test-arm64 test-x86
docker rm test-arm64 test-x86
```

**Expected Differences**:
- ARM64: osArch="aarch64", architectureType="ARM64 (Graviton)"
- x86: osArch="amd64", architectureType="x86_64 (Intel/AMD)"

**Expected Similarities**:
- Same Java version (17.x.x)
- Same Java vendor (Eclipse Temurin)
- Same endpoint responses (except architecture info)
- Same application behavior

## Test Failure Analysis

### If Tests Fail on ARM64

#### Scenario 1: Architecture Not Detected as ARM64
```
Symptom: architectureType is not "ARM64 (Graviton)"
Possible Causes:
- Not running on ARM64 platform (check docker inspect)
- SystemInfoService logic error
- Incorrect platform flag in docker run
```

**Debug Steps**:
```bash
# Verify container platform
docker inspect graviton-test | grep -i architecture
# Should show: "Architecture": "arm64"

# Check Java os.arch property
docker exec graviton-test java -XshowSettings:properties -version 2>&1 | grep os.arch
# Should show: os.arch = aarch64
```

#### Scenario 2: Application Fails to Start
```
Symptom: Container exits immediately or health check fails
Possible Causes:
- JVM flag compatibility issue
- Port already in use
- Insufficient memory
```

**Debug Steps**:
```bash
# Check container logs
docker logs graviton-test

# Look for:
# - Unrecognized VM option errors
# - OutOfMemoryError
# - Port binding errors
```

#### Scenario 3: Benchmark Performance Issues
```
Symptom: Benchmark endpoint slow or times out
Possible Causes:
- QEMU emulation (if running ARM64 on x86)
- CPU throttling
- Memory constraints
```

**Debug Steps**:
```bash
# Check if running under emulation
docker inspect graviton-test | grep -i platform

# Monitor CPU usage
docker stats graviton-test
```

## Integration with CI/CD

### GitHub Actions ARM64 Testing
```yaml
name: ARM64 Functional Tests

on: [push, pull_request]

jobs:
  test-arm64:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up QEMU
        uses: docker/setup-qemu-action@v2
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Build ARM64 image
        run: docker buildx build --platform linux/arm64 -t graviton-demo:arm64 --load .
      
      - name: Run functional tests
        run: ./test-arm64-functional.sh
```

### AWS CodeBuild on Graviton
```yaml
version: 0.2

phases:
  build:
    commands:
      - docker build -t graviton-demo:arm64 .
      - docker run -d -p 8080:8080 --name test graviton-demo:arm64
      - sleep 15
      - ./test-arm64-functional.sh
      - docker stop test
```

## Success Criteria

### All Tests Must Pass
- ✅ Application context loads successfully
- ✅ All 5 unit tests pass
- ✅ Health endpoints respond correctly
- ✅ ARM64 architecture correctly detected
- ✅ SystemInfoService returns "ARM64 (Graviton)"
- ✅ os.arch property is "aarch64"
- ✅ Java version is 17.x (Eclipse Temurin)
- ✅ Benchmark operations complete without errors
- ✅ Metrics endpoints provide accurate data
- ✅ No architecture-specific failures detected

### Behavior Consistency
- ✅ Application behavior identical between ARM64 and x86 (except architecture detection)
- ✅ Response times within acceptable range
- ✅ No errors or exceptions in logs
- ✅ Memory usage stable (no leaks)

## Cleanup

```bash
# Stop and remove test container
docker stop graviton-test
docker rm graviton-test

# Remove test images (optional)
docker rmi graviton-demo:arm64
docker rmi graviton-demo:amd64
```

## Next Steps

After successful functional testing:
- **Step 7**: Performance and Stability Validation (load testing, metrics monitoring)
- **Step 8**: Multi-Architecture CI/CD and Documentation

## Documentation Complete

This comprehensive functional testing guide ensures:
1. All application endpoints work correctly on ARM64
2. Architecture detection functions properly
3. Java 17 Eclipse Temurin is confirmed
4. No architecture-specific issues exist
5. Application behavior is consistent across platforms
6. Test automation is available for CI/CD integration
