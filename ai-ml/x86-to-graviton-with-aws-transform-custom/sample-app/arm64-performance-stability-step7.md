# Performance and Stability Validation on ARM64 - Step 7

## Overview
This document provides comprehensive guidance for validating application performance, stability, and Graviton-specific JVM optimizations on ARM64 architecture.

## Objectives
1. Verify application starts successfully without errors on ARM64
2. Confirm Graviton-optimized JVM flags are active
3. Validate application stability under load
4. Monitor memory usage and GC behavior
5. Detect memory leaks during extended operation
6. Test multi-threading functionality
7. Verify metrics endpoints accuracy
8. Document performance characteristics

## Prerequisites

### Environment Setup
```bash
# Start ARM64 container with monitoring enabled
docker run --platform linux/arm64 -d \
  -p 8080:8080 \
  --name graviton-perf-test \
  graviton-demo:arm64

# Wait for startup
sleep 20

# Verify container is running
docker ps | grep graviton-perf-test
```

### Required Tools
- curl (API testing)
- jq (JSON processing, optional but recommended)
- docker (container management)
- Any load testing tool (optional: ab, wrk, hey, JMeter)

## Validation Steps

### Step 1: Application Startup Validation

```bash
# Check container logs for successful startup
docker logs graviton-perf-test | tail -30

# Look for:
# - "Started DemoApplication in X.XXX seconds"
# - No "ERROR" or "WARN" messages related to JVM flags
# - "Tomcat started on port(s): 8080"
```

**Expected Output Indicators**:
```
INFO [main] com.example.demo.DemoApplication : Starting DemoApplication
INFO [main] o.s.b.w.embedded.tomcat.TomcatWebServer : Tomcat initialized with port(s): 8080 (http)
INFO [main] com.example.demo.DemoApplication : Started DemoApplication in 3.456 seconds (JVM running for 3.789)
```

**Success Criteria**:
- ✅ No errors during startup
- ✅ Application starts in < 10 seconds
- ✅ Tomcat binds to port 8080
- ✅ Spring Boot context loads successfully

### Step 2: JVM Flag Verification

#### Check Container Startup Logs for JVM Initialization
```bash
# View full logs to see JVM initialization
docker logs graviton-perf-test 2>&1 | head -50
```

**Expected JVM Flags (Graviton-Optimized)**:
- `-XX:-TieredCompilation` (disabled tiered compilation)
- `-XX:ReservedCodeCacheSize=64M` (code cache size)
- `-XX:InitialCodeCacheSize=64M` (initial code cache)
- `-XX:CICompilerCount=2` (compiler threads)
- `-XX:CompilationMode=high-only` (C2 compiler only)
- `-XX:+UseG1GC` (G1 garbage collector)
- `-XX:MaxRAMPercentage=75.0` (memory limit)

#### Verify JVM Flags via Runtime MXBean
```bash
# Get JVM runtime info
curl -s http://localhost:8080/actuator/info

# Check JVM arguments (if exposed via actuator)
curl -s http://localhost:8080/actuator/metrics | jq '.names[] | select(contains("jvm"))'
```

**Validation**:
- ✅ No "Unrecognized VM option" errors in logs
- ✅ JVM starts with all Graviton-optimized flags
- ✅ Memory settings are respected

### Step 3: Load Testing and Stability Validation

#### Basic Load Test (Light Load)
```bash
# Send 100 requests to benchmark endpoint
for i in {1..100}; do
    curl -s "http://localhost:8080/api/compute/benchmark?iterations=1000" > /dev/null
    echo -n "."
done
echo ""
echo "✅ Light load test completed (100 requests)"
```

#### Moderate Load Test
```bash
# Concurrent requests (10 parallel)
echo "Running moderate load test (10 concurrent, 50 iterations each)..."
for i in {1..10}; do
    (
        for j in {1..50}; do
            curl -s "http://localhost:8080/api/compute/benchmark?iterations=5000" > /dev/null
        done
    ) &
done
wait
echo "✅ Moderate load test completed (500 total requests)"
```

#### Using Apache Bench (if available)
```bash
# Install ab (Apache Bench)
# macOS: brew install apache2
# Ubuntu: sudo apt-get install apache2-utils

# Run load test: 1000 requests, 10 concurrent
ab -n 1000 -c 10 "http://localhost:8080/api/compute/benchmark?iterations=1000"
```

**Expected Results**:
```
Concurrency Level:      10
Time taken for tests:   XX.XXX seconds
Complete requests:      1000
Failed requests:        0
Requests per second:    XX.XX [#/sec]
Time per request:       XX.XXX [ms] (mean)
```

#### Using wrk (if available)
```bash
# Install wrk
# macOS: brew install wrk
# Ubuntu: git clone https://github.com/wg/wrk && cd wrk && make

# Run load test: 10 threads, 50 connections, 30 seconds
wrk -t10 -c50 -d30s "http://localhost:8080/api/compute/benchmark?iterations=1000"
```

### Step 4: Memory Usage Monitoring

#### Initial Memory State
```bash
# Get initial JVM memory metrics
echo "=== Initial Memory State ==="
curl -s http://localhost:8080/actuator/metrics/jvm.memory.used | jq

# Memory breakdown by type
echo "=== Heap Memory ==="
curl -s http://localhost:8080/actuator/metrics/jvm.memory.used?tag=area:heap | jq '.measurements[0].value'

echo "=== Non-Heap Memory ==="
curl -s http://localhost:8080/actuator/metrics/jvm.memory.used?tag=area:nonheap | jq '.measurements[0].value'
```

#### Run Load and Monitor Memory
```bash
#!/bin/bash
# memory-monitor.sh - Monitor memory during load test

echo "Starting memory monitoring..."
echo "Timestamp,HeapUsed(MB),NonHeapUsed(MB)" > memory-log.csv

# Run for 10 minutes
for i in {1..60}; do
    # Get memory metrics
    HEAP=$(curl -s http://localhost:8080/actuator/metrics/jvm.memory.used?tag=area:heap | jq -r '.measurements[0].value')
    NONHEAP=$(curl -s http://localhost:8080/actuator/metrics/jvm.memory.used?tag=area:nonheap | jq -r '.measurements[0].value')
    
    # Convert to MB
    HEAP_MB=$(echo "scale=2; $HEAP / 1048576" | bc)
    NONHEAP_MB=$(echo "scale=2; $NONHEAP / 1048576" | bc)
    
    # Log
    echo "$(date +%H:%M:%S),$HEAP_MB,$NONHEAP_MB" >> memory-log.csv
    echo "[$i/60] Heap: ${HEAP_MB}MB, Non-Heap: ${NONHEAP_MB}MB"
    
    # Run some load every iteration
    for j in {1..10}; do
        curl -s "http://localhost:8080/api/compute/benchmark?iterations=5000" > /dev/null &
    done
    
    sleep 10
done

wait
echo "✅ Memory monitoring complete. Check memory-log.csv"
```

**Analysis**:
```bash
# Check for memory leaks (memory should stabilize, not grow unbounded)
tail -20 memory-log.csv

# Expected pattern:
# - Initial growth as caches warm up
# - Stabilization after ~2-3 minutes
# - GC should keep memory within MaxRAMPercentage (75%)
# - No continuous upward trend
```

#### Memory Leak Detection
```bash
# Get memory after 1 minute
sleep 60
MEM_1=$(curl -s http://localhost:8080/actuator/metrics/jvm.memory.used?tag=area:heap | jq -r '.measurements[0].value')

# Run load for 5 minutes
echo "Running extended load test (5 minutes)..."
for i in {1..300}; do
    curl -s "http://localhost:8080/api/compute/benchmark?iterations=2000" > /dev/null &
    sleep 1
done
wait

# Get memory after load
MEM_2=$(curl -s http://localhost:8080/actuator/metrics/jvm.memory.used?tag=area:heap | jq -r '.measurements[0].value')

# Calculate growth
GROWTH=$(echo "scale=2; ($MEM_2 - $MEM_1) / 1048576" | bc)
echo "Memory growth: ${GROWTH}MB"

# Acceptable growth: < 50MB for 5 minute test
# Significant growth (>100MB) may indicate memory leak
```

### Step 5: Garbage Collection Monitoring

#### GC Pause Times
```bash
# Monitor GC pause times
echo "=== GC Pause Metrics ==="
curl -s http://localhost:8080/actuator/metrics/jvm.gc.pause | jq

# GC count
echo "=== GC Count ==="
curl -s http://localhost:8080/actuator/metrics/jvm.gc.pause | jq '.measurements[] | select(.statistic=="COUNT")'

# GC total time
echo "=== GC Total Time ==="
curl -s http://localhost:8080/actuator/metrics/jvm.gc.pause | jq '.measurements[] | select(.statistic=="TOTAL_TIME")'

# GC max time (should be low with G1GC on Graviton)
echo "=== GC Max Pause ==="
curl -s http://localhost:8080/actuator/metrics/jvm.gc.pause | jq '.measurements[] | select(.statistic=="MAX")'
```

**Expected G1GC Performance on Graviton**:
- Max pause time: < 50ms (excellent), < 100ms (good)
- Average pause time: < 20ms
- GC frequency: Depends on heap size and load
- Total GC time: < 5% of total runtime

#### Continuous GC Monitoring
```bash
# Monitor GC over time
for i in {1..30}; do
    echo "=== Minute $i ==="
    GC_COUNT=$(curl -s http://localhost:8080/actuator/metrics/jvm.gc.pause | jq '.measurements[] | select(.statistic=="COUNT") | .value')
    GC_TOTAL=$(curl -s http://localhost:8080/actuator/metrics/jvm.gc.pause | jq '.measurements[] | select(.statistic=="TOTAL_TIME") | .value')
    GC_MAX=$(curl -s http://localhost:8080/actuator/metrics/jvm.gc.pause | jq '.measurements[] | select(.statistic=="MAX") | .value')
    
    echo "GC Count: $GC_COUNT, Total: ${GC_TOTAL}s, Max: ${GC_MAX}s"
    
    # Run load
    for j in {1..20}; do
        curl -s "http://localhost:8080/api/compute/benchmark?iterations=3000" > /dev/null &
    done
    
    sleep 60
done
wait
```

### Step 6: Multi-Threading Validation

#### Test Concurrent Request Handling
```bash
# Test with varying concurrency levels
for CONCURRENCY in 5 10 20 50; do
    echo "Testing with $CONCURRENCY concurrent threads..."
    
    # Start concurrent requests
    for i in $(seq 1 $CONCURRENCY); do
        (
            for j in {1..20}; do
                curl -s "http://localhost:8080/api/compute/benchmark?iterations=5000" > /dev/null
            done
        ) &
    done
    
    # Wait for all to complete
    wait
    
    # Check thread count
    THREADS=$(curl -s http://localhost:8080/actuator/metrics/jvm.threads.live | jq '.measurements[0].value')
    echo "Active threads: $THREADS"
    echo ""
done
```

**Expected Behavior**:
- ✅ All requests complete successfully
- ✅ No deadlocks or thread starvation
- ✅ Thread count scales appropriately
- ✅ No "Too many open files" errors
- ✅ Performance degrades gracefully under high load

#### Thread Metrics
```bash
# Monitor thread metrics
echo "=== Thread Metrics ==="
echo "Live threads:"
curl -s http://localhost:8080/actuator/metrics/jvm.threads.live | jq '.measurements[0].value'

echo "Peak threads:"
curl -s http://localhost:8080/actuator/metrics/jvm.threads.peak | jq '.measurements[0].value'

echo "Daemon threads:"
curl -s http://localhost:8080/actuator/metrics/jvm.threads.daemon | jq '.measurements[0].value'

echo "Thread states:"
curl -s http://localhost:8080/actuator/metrics/jvm.threads.states | jq
```

### Step 7: Prometheus Metrics Validation

#### Export Metrics
```bash
# Get full Prometheus metrics dump
curl -s http://localhost:8080/actuator/prometheus > metrics-arm64.txt

# Verify key metrics exist
echo "=== Verifying Key Metrics ==="
grep "jvm_memory_used_bytes" metrics-arm64.txt && echo "✅ Memory metrics present"
grep "jvm_gc_pause_seconds" metrics-arm64.txt && echo "✅ GC metrics present"
grep "process_cpu_usage" metrics-arm64.txt && echo "✅ CPU metrics present"
grep "system_cpu_count" metrics-arm64.txt && echo "✅ System metrics present"
grep "http_server_requests" metrics-arm64.txt && echo "✅ HTTP metrics present"
```

#### Validate Metrics Accuracy
```bash
# Compare CPU count with actual
METRIC_CPU=$(curl -s http://localhost:8080/actuator/prometheus | grep "^system_cpu_count" | awk '{print $2}')
ACTUAL_CPU=$(docker exec graviton-perf-test nproc)

echo "CPU count from metrics: $METRIC_CPU"
echo "Actual CPU count: $ACTUAL_CPU"

if [ "$METRIC_CPU" = "$ACTUAL_CPU" ]; then
    echo "✅ CPU count matches"
else
    echo "⚠️  CPU count mismatch"
fi
```

### Step 8: Extended Stability Test (5-10 Minutes)

#### Automated Stability Test Script
```bash
#!/bin/bash
# stability-test.sh - Extended stability validation

DURATION_MINUTES=10
REQUESTS_PER_MINUTE=60
BASE_URL="http://localhost:8080"

echo "=========================================="
echo "ARM64 Stability Test ($DURATION_MINUTES minutes)"
echo "=========================================="
echo ""

# Record initial state
echo "Initial state:"
curl -s $BASE_URL/actuator/health | jq
INITIAL_MEM=$(curl -s $BASE_URL/actuator/metrics/jvm.memory.used?tag=area:heap | jq -r '.measurements[0].value')
echo "Initial heap: $(echo "scale=2; $INITIAL_MEM / 1048576" | bc)MB"
echo ""

# Run stability test
START_TIME=$(date +%s)
TOTAL_REQUESTS=0
FAILED_REQUESTS=0

for MINUTE in $(seq 1 $DURATION_MINUTES); do
    echo "=== Minute $MINUTE/$DURATION_MINUTES ==="
    
    # Send requests
    for i in $(seq 1 $REQUESTS_PER_MINUTE); do
        if ! curl -s -f "$BASE_URL/api/compute/benchmark?iterations=2000" > /dev/null 2>&1; then
            ((FAILED_REQUESTS++))
        fi
        ((TOTAL_REQUESTS++))
    done
    
    # Check health
    STATUS=$(curl -s $BASE_URL/actuator/health | jq -r '.status')
    if [ "$STATUS" != "UP" ]; then
        echo "❌ Health check failed: $STATUS"
        exit 1
    fi
    
    # Check memory
    CURRENT_MEM=$(curl -s $BASE_URL/actuator/metrics/jvm.memory.used?tag=area:heap | jq -r '.measurements[0].value')
    CURRENT_MEM_MB=$(echo "scale=2; $CURRENT_MEM / 1048576" | bc)
    echo "Heap memory: ${CURRENT_MEM_MB}MB"
    
    # Check GC
    GC_COUNT=$(curl -s $BASE_URL/actuator/metrics/jvm.gc.pause | jq '.measurements[] | select(.statistic=="COUNT") | .value')
    echo "GC collections: $GC_COUNT"
    
    echo ""
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

# Final state
FINAL_MEM=$(curl -s $BASE_URL/actuator/metrics/jvm.memory.used?tag=area:heap | jq -r '.measurements[0].value')
MEM_GROWTH=$(echo "scale=2; ($FINAL_MEM - $INITIAL_MEM) / 1048576" | bc)

echo "=========================================="
echo "✅ Stability Test Complete"
echo "=========================================="
echo ""
echo "Summary:"
echo "- Duration: $ELAPSED seconds"
echo "- Total requests: $TOTAL_REQUESTS"
echo "- Failed requests: $FAILED_REQUESTS"
echo "- Success rate: $(echo "scale=2; 100 * ($TOTAL_REQUESTS - $FAILED_REQUESTS) / $TOTAL_REQUESTS" | bc)%"
echo "- Memory growth: ${MEM_GROWTH}MB"
echo ""

# Validate results
if [ $FAILED_REQUESTS -eq 0 ]; then
    echo "✅ PASS: No failed requests"
else
    echo "⚠️  WARNING: $FAILED_REQUESTS failed requests"
fi

if [ $(echo "$MEM_GROWTH < 100" | bc) -eq 1 ]; then
    echo "✅ PASS: Memory growth acceptable (${MEM_GROWTH}MB)"
else
    echo "⚠️  WARNING: High memory growth (${MEM_GROWTH}MB)"
fi
```

### Step 9: Performance Comparison (ARM64 vs x86)

#### Side-by-Side Performance Test
```bash
#!/bin/bash
# compare-performance.sh - Compare ARM64 vs x86 performance

echo "=========================================="
echo "Performance Comparison: ARM64 vs x86"
echo "=========================================="
echo ""

# Start both containers
echo "Starting containers..."
docker run --platform linux/arm64 -d -p 8080:8080 --name perf-arm64 graviton-demo:arm64
docker run --platform linux/amd64 -d -p 8081:8080 --name perf-x86 graviton-demo:amd64

sleep 20

# Test ARM64
echo "=== ARM64 Performance ==="
START_ARM64=$(date +%s%3N)
for i in {1..100}; do
    curl -s "http://localhost:8080/api/compute/benchmark?iterations=10000" > /dev/null
done
END_ARM64=$(date +%s%3N)
DURATION_ARM64=$((END_ARM64 - START_ARM64))
echo "100 requests completed in: ${DURATION_ARM64}ms"
echo "Average: $(echo "scale=2; $DURATION_ARM64 / 100" | bc)ms per request"

# Test x86
echo ""
echo "=== x86 Performance ==="
START_X86=$(date +%s%3N)
for i in {1..100}; do
    curl -s "http://localhost:8081/api/compute/benchmark?iterations=10000" > /dev/null
done
END_X86=$(date +%s%3N)
DURATION_X86=$((END_X86 - START_X86))
echo "100 requests completed in: ${DURATION_X86}ms"
echo "Average: $(echo "scale=2; $DURATION_X86 / 100" | bc)ms per request"

# Compare
echo ""
echo "=== Comparison ==="
DIFF=$((DURATION_ARM64 - DURATION_X86))
if [ $DIFF -lt 0 ]; then
    echo "ARM64 is faster by $((DIFF * -1))ms ($(echo "scale=1; 100 * $DIFF / $DURATION_X86 * -1" | bc)%)"
else
    echo "x86 is faster by ${DIFF}ms ($(echo "scale=1; 100 * $DIFF / $DURATION_ARM64" | bc)%)"
fi

# Cleanup
docker stop perf-arm64 perf-x86
docker rm perf-arm64 perf-x86
```

**Note**: Performance comparison on emulated ARM64 (QEMU on x86) is NOT accurate. For valid comparison, run on native Graviton hardware.

## Success Criteria

### Application Startup
- ✅ Application starts successfully without errors
- ✅ Startup time < 10 seconds
- ✅ No JVM flag errors in logs

### JVM Flags
- ✅ All Graviton-optimized flags active:
  - -XX:-TieredCompilation
  - -XX:ReservedCodeCacheSize=64M
  - -XX:InitialCodeCacheSize=64M
  - -XX:CICompilerCount=2
  - -XX:CompilationMode=high-only
  - -XX:+UseG1GC
- ✅ No unrecognized option errors

### Load Testing
- ✅ Application remains stable under load (500+ requests)
- ✅ No crashes or out-of-memory errors
- ✅ Request success rate: 100%
- ✅ Response times within acceptable range

### Memory Management
- ✅ No memory leaks detected (growth < 100MB over 10 minutes)
- ✅ Memory usage stays within MaxRAMPercentage (75%)
- ✅ Memory stabilizes after warmup period

### Garbage Collection
- ✅ GC behavior shows optimized performance with G1GC
- ✅ Max GC pause < 100ms (preferably < 50ms)
- ✅ Total GC time < 5% of runtime
- ✅ No excessive GC frequency

### Multi-Threading
- ✅ Concurrent requests handled correctly
- ✅ No deadlocks or thread starvation
- ✅ Thread count scales appropriately
- ✅ No thread-related errors

### Metrics
- ✅ Prometheus metrics export correctly
- ✅ All key metrics present (JVM, GC, HTTP, system)
- ✅ Metric values are accurate
- ✅ Metrics update in real-time

### Extended Stability
- ✅ Application runs for 10+ minutes without degradation
- ✅ No performance degradation over time
- ✅ Health checks remain UP throughout test
- ✅ Memory remains stable

## Troubleshooting

### High GC Frequency
```
Symptom: Frequent GC collections, high GC time percentage
Possible Causes:
- Heap size too small
- Memory leak
- Excessive object creation

Solution:
- Increase MaxRAMPercentage if needed
- Review memory-log.csv for leak patterns
- Profile application for object allocation hotspots
```

### Memory Growth
```
Symptom: Continuous memory growth over time
Diagnosis:
1. Check memory-log.csv for trends
2. Look for increasing heap usage without GC
3. Run extended test (30+ minutes)

Solution:
- If growth stabilizes: Normal warmup behavior
- If continuous growth: Potential memory leak, needs investigation
```

### Poor Performance
```
Symptom: Slow response times, high latency
Possible Causes:
- Running under QEMU emulation (x86 host)
- CPU throttling
- Insufficient resources

Solution:
- Use native ARM64 system (AWS Graviton EC2)
- Check docker stats for resource usage
- Increase container memory/CPU limits
```

## Performance Expectations on Graviton

### Expected Improvements (vs baseline ARM64 without optimizations)
- **Throughput**: 10-15% improvement
- **Memory footprint**: 30-50% reduction in code cache
- **GC pause times**: 5-10% improvement (P99)
- **Startup time**: Slightly slower (~5-10%) but better steady-state

### Comparison with x86
**Note**: On native Graviton hardware (not emulated):
- Performance should be competitive with or better than x86
- Memory efficiency may be better on Graviton
- GC behavior should be similar or improved
- Specific results depend on workload characteristics

## User Responsibility

**Detailed performance benchmarking should be conducted by the user based on:**
- Their specific performance requirements
- Their workload characteristics
- Their measurement tools and baselines
- Their acceptable performance thresholds

This validation focuses on:
- Stability (no crashes)
- Correctness (no functional issues)
- Optimization verification (flags applied correctly)
- Basic performance characteristics

## Cleanup

```bash
# Stop performance test container
docker stop graviton-perf-test
docker rm graviton-perf-test

# Remove logs and metrics files
rm -f memory-log.csv metrics-arm64.txt
```

## Next Steps

After successful performance and stability validation:
- **Step 8**: Multi-Architecture CI/CD and Documentation (final step)

## Summary

This comprehensive performance and stability validation ensures:
1. ✅ Application is stable on ARM64 architecture
2. ✅ Graviton-optimized JVM flags are working correctly
3. ✅ No memory leaks exist
4. ✅ GC behavior is optimized with G1GC
5. ✅ Multi-threading works correctly
6. ✅ Metrics are accurate and exportable
7. ✅ Application can handle production workloads on Graviton

The application is ready for production deployment on AWS Graviton instances.
