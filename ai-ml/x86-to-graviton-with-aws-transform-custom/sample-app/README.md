# Graviton Demo - Spring Boot Application

A Spring Boot 3.2.1 application optimized for AWS Graviton (ARM64) processors, demonstrating multi-architecture container deployment and ARM64-specific performance optimizations.

## Features

- ✅ **Multi-Architecture Support**: Runs on both ARM64 (Graviton) and x86 architectures
- ✅ **Graviton-Optimized**: Includes JVM flags specifically tuned for AWS Graviton processors
- ✅ **Pure Java**: No native dependencies, fully portable across architectures
- ✅ **Production-Ready**: Comprehensive testing and validation on ARM64
- ✅ **Monitoring**: Actuator endpoints with Prometheus metrics export
- ✅ **Health Checks**: Built-in health endpoints for container orchestration

## Technology Stack

- **Java**: 17 (Eclipse Temurin JDK)
- **Framework**: Spring Boot 3.2.1
- **Build Tool**: Maven 3.9+
- **Container**: Docker with multi-architecture support
- **Metrics**: Micrometer with Prometheus

## ARM64 (AWS Graviton) Compatibility

### Status: ✅ FULLY COMPATIBLE

This application has been validated for AWS Graviton deployment:
- **No code changes** required for ARM64 compatibility
- **No dependency upgrades** needed
- **All tests passing** on ARM64 architecture
- **Performance optimizations** applied for Graviton

### What Makes This Application ARM64-Ready?

1. **Pure Java**: No native libraries (`.so`, `.dll`, `.dylib` files)
2. **Modern Dependencies**: Spring Boot 3.2.1 fully supports ARM64
3. **Architecture Detection**: Automatically detects and reports ARM64/Graviton
4. **Optimized JVM Flags**: Graviton-specific tuning for best performance

## Quick Start

### Prerequisites

- Docker 20.10+ with buildx support
- Java 17+ (for local development)
- Maven 3.9+ (for local development)

### Running with Docker (Recommended)

#### On ARM64/Graviton:
```bash
# Build and run
docker buildx build --platform linux/arm64 -t graviton-demo:arm64 --load .
docker run -d -p 8080:8080 graviton-demo:arm64

# Verify architecture
curl http://localhost:8080/api/system-info | jq '.architectureType'
# Returns: "ARM64 (Graviton)"
```

#### On x86/amd64:
```bash
# Build and run
docker buildx build --platform linux/amd64 -t graviton-demo:amd64 --load .
docker run -d -p 8080:8080 graviton-demo:amd64

# Verify architecture
curl http://localhost:8080/api/system-info | jq '.architectureType'
# Returns: "x86_64 (Intel/AMD)"
```

#### Using Docker Compose:
```bash
# Uses docker-compose.yml with multi-architecture support
docker-compose up -d
```

### Running Locally (Development)

```bash
# Build
mvn clean package

# Run
java -jar target/graviton-demo-1.0.0.jar

# Or use Spring Boot Maven plugin
mvn spring-boot:run
```

## API Endpoints

### Application Endpoints

- **GET `/api/health`**: Simple health check
  ```bash
  curl http://localhost:8080/api/health
  # Returns: "OK"
  ```

- **GET `/api/system-info`**: System and architecture information
  ```bash
  curl http://localhost:8080/api/system-info | jq
  ```
  Example response:
  ```json
  {
    "osName": "Linux",
    "osArch": "aarch64",
    "osVersion": "5.15.0",
    "javaVersion": "17.0.9",
    "javaVendor": "Eclipse Adoptium",
    "javaVmName": "OpenJDK 64-Bit Server VM",
    "availableProcessors": 2,
    "maxMemory": 536870912,
    "totalMemory": 134217728,
    "freeMemory": 89478485,
    "architectureType": "ARM64 (Graviton)"
  }
  ```

- **GET `/api/compute/benchmark?iterations=10000`**: Compute performance benchmark
  ```bash
  curl "http://localhost:8080/api/compute/benchmark?iterations=10000" | jq
  ```

### Actuator Endpoints

- **GET `/actuator/health`**: Detailed health status
- **GET `/actuator/info`**: Application information
- **GET `/actuator/metrics`**: Available metrics list
- **GET `/actuator/metrics/{metricName}`**: Specific metric details
- **GET `/actuator/prometheus`**: Prometheus-format metrics export

Examples:
```bash
# Health check
curl http://localhost:8080/actuator/health | jq

# JVM memory usage
curl http://localhost:8080/actuator/metrics/jvm.memory.used | jq

# GC metrics
curl http://localhost:8080/actuator/metrics/jvm.gc.pause | jq

# Prometheus export
curl http://localhost:8080/actuator/prometheus
```

## AWS Graviton Deployment

### EC2 Deployment

1. **Launch Graviton Instance**:
   ```bash
   # Example: m7g.xlarge (4 vCPU, 16 GB RAM)
   aws ec2 run-instances \
     --image-id ami-xxxxx \
     --instance-type m7g.xlarge \
     --key-name your-key
   ```

2. **Install Docker**:
   ```bash
   # Amazon Linux 2023
   sudo yum update -y
   sudo yum install -y docker
   sudo systemctl start docker
   sudo systemctl enable docker
   ```

3. **Deploy Application**:
   ```bash
   # Pull and run
   docker run -d -p 8080:8080 --name graviton-demo \
     --restart unless-stopped \
     graviton-demo:arm64
   ```

### Recommended Instance Types

| Instance Family | Use Case | vCPU Range | Memory Range |
|----------------|----------|------------|--------------|
| **c7g** | Compute-optimized | 1-64 | 2-128 GB |
| **m7g** | General purpose | 1-64 | 4-256 GB |
| **r7g** | Memory-optimized | 1-64 | 8-512 GB |
| **t4g** | Burstable | 2-8 | 0.5-32 GB |

### ECS on Graviton

```json
{
  "family": "graviton-demo",
  "runtimePlatform": {
    "cpuArchitecture": "ARM64",
    "operatingSystemFamily": "LINUX"
  },
  "containerDefinitions": [{
    "name": "app",
    "image": "your-registry/graviton-demo:arm64",
    "cpu": 2048,
    "memory": 4096,
    "portMappings": [{
      "containerPort": 8080,
      "protocol": "tcp"
    }],
    "healthCheck": {
      "command": ["CMD-SHELL", "curl -f http://localhost:8080/actuator/health || exit 1"],
      "interval": 30,
      "timeout": 5,
      "retries": 3,
      "startPeriod": 60
    }
  }]
}
```

### EKS with Graviton Node Groups

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: graviton-demo
spec:
  replicas: 3
  selector:
    matchLabels:
      app: graviton-demo
  template:
    metadata:
      labels:
        app: graviton-demo
    spec:
      nodeSelector:
        kubernetes.io/arch: arm64
      containers:
      - name: app
        image: your-registry/graviton-demo:arm64
        ports:
        - containerPort: 8080
        livenessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
```

## Performance Optimizations

### Graviton-Specific JVM Flags

This application includes JVM flags optimized for AWS Graviton processors:

```bash
-XX:-TieredCompilation         # Reduces compilation overhead
-XX:ReservedCodeCacheSize=64M  # Optimized code cache size
-XX:InitialCodeCacheSize=64M   # Initial code cache allocation
-XX:CICompilerCount=2          # Compiler thread count for Graviton
-XX:CompilationMode=high-only  # Use C2 compiler only for better ARM64 performance
-XX:+UseG1GC                   # G1 garbage collector (works well on Graviton)
```

### Expected Performance Improvements

On AWS Graviton vs baseline ARM64 (without optimizations):
- **Throughput**: 10-15% improvement
- **Memory footprint**: 30-50% reduction in code cache usage
- **Latency (P99)**: 5-10% improvement

On AWS Graviton vs x86 (comparable instances):
- **Price/Performance**: Up to 40% better value
- **Energy Efficiency**: Lower power consumption
- **Performance**: Competitive or better for most workloads

## Multi-Architecture Build

### Building for Multiple Architectures

```bash
# Build for ARM64 only
docker buildx build --platform linux/arm64 -t graviton-demo:arm64 --load .

# Build for x86 only
docker buildx build --platform linux/amd64 -t graviton-demo:amd64 --load .

# Build for both (requires pushing to registry)
docker buildx build \
  --platform linux/arm64,linux/amd64 \
  -t your-registry/graviton-demo:latest \
  --push .
```

### CI/CD Integration

#### GitHub Actions
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

#### AWS CodeBuild on Graviton
```yaml
version: 0.2
phases:
  build:
    commands:
      - docker build -t graviton-demo:arm64 .
environment:
  type: ARM_CONTAINER  # Use ARM64 build environment
  image: aws/codebuild/amazonlinux2-aarch64-standard:3.0
```

## Testing

### Run Unit Tests

```bash
# With Maven
mvn test

# With Docker (build stage includes tests)
docker buildx build --platform linux/arm64 -t graviton-demo:arm64-test .
```

### Validate ARM64 Build

Automated validation script provided:
```bash
# Complete build validation
./validate-arm64-build.sh
```

### Functional Testing

Automated functional test script:
```bash
# Run comprehensive functional tests
./test-arm64-functional.sh
```

### Performance Testing

Automated performance and stability validation:
```bash
# 10-minute stability and performance test
./test-arm64-performance.sh
```

## Monitoring and Metrics

### Prometheus Integration

```yaml
scrape_configs:
  - job_name: 'graviton-demo'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['localhost:8080']
```

### Key Metrics to Monitor

- **JVM Memory**: `jvm_memory_used_bytes{area="heap"}`
- **GC Pauses**: `jvm_gc_pause_seconds_max`
- **HTTP Requests**: `http_server_requests_seconds_count`
- **CPU Usage**: `process_cpu_usage`
- **Thread Count**: `jvm_threads_live`

### Grafana Dashboard

Import metrics to Grafana for visualization:
- JVM memory usage over time
- GC pause frequency and duration
- Request rate and response times
- System resource utilization

## Troubleshooting

### Common Issues

**Issue**: Application not detecting ARM64 architecture  
**Solution**: Ensure running on ARM64 system or use `--platform linux/arm64` flag

**Issue**: Slow performance on x86 when testing ARM64 image  
**Solution**: This is normal (QEMU emulation). Use native Graviton for accurate testing

**Issue**: JVM flag errors  
**Solution**: Verify Java 17+ is being used (flags require Java 17+)

### Debug Commands

```bash
# Check container architecture
docker inspect graviton-demo | grep -i architecture

# Check Java version in container
docker exec graviton-demo java -version

# Check JVM flags
docker logs graviton-demo | grep -i "command line"

# Check application logs
docker logs graviton-demo

# Check health status
curl http://localhost:8080/actuator/health
```

## Documentation

### Additional Resources

- **[ARM64-COMPATIBILITY-REPORT.md](ARM64-COMPATIBILITY-REPORT.md)**: Complete compatibility analysis
- **[arm64-build-validation-step5.md](arm64-build-validation-step5.md)**: Build validation procedures
- **[arm64-functional-testing-step6.md](arm64-functional-testing-step6.md)**: Functional testing guide
- **[arm64-performance-stability-step7.md](arm64-performance-stability-step7.md)**: Performance validation

### Validation Scripts

- **`validate-arm64-build.sh`**: Automated build validation
- **`test-arm64-functional.sh`**: Functional testing automation
- **`test-arm64-performance.sh`**: Performance and stability testing

## Cost Savings

### Expected Savings with Graviton

Example: m7g.xlarge vs m6i.xlarge
- **Performance**: Similar or better
- **Cost**: ~20% lower on-demand pricing
- **With Reserved Instances**: Up to 40% total savings
- **Energy**: Lower power consumption

## Support and Contributing

For issues or questions about ARM64 deployment:
1. Review the ARM64 Compatibility Report
2. Check troubleshooting section
3. Verify system meets prerequisites

## License

[Your License Here]

## Architecture Summary

- **Language**: Java 17
- **Framework**: Spring Boot 3.2.1
- **Build Tool**: Maven
- **Packaging**: Docker Container
- **Deployment**: Multi-architecture (ARM64/x86)
- **Monitoring**: Actuator + Prometheus
- **Cloud**: AWS Graviton optimized

---

**Status**: ✅ Ready for AWS Graviton deployment  
**ARM64 Validated**: Yes (all tests passing)  
**Production Ready**: Yes  
**Last Updated**: 2026-02-03
