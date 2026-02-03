# Multi-architecture Dockerfile for x86 and ARM64 (Graviton)
# Supports both linux/amd64 and linux/arm64 platforms

# Build stage
FROM --platform=$BUILDPLATFORM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /app

# Copy pom.xml first for dependency caching
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source and build
COPY src ./src
RUN mvn clean package -DskipTests -B

# Runtime stage - uses platform-specific base image
FROM eclipse-temurin:17-jre

# Add labels for architecture identification
ARG TARGETPLATFORM
ARG TARGETARCH
LABEL architecture="${TARGETARCH}"
LABEL platform="${TARGETPLATFORM}"

WORKDIR /app

# Install curl for healthcheck and create non-root user
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appgroup && useradd -r -g appgroup appuser

# Copy the built artifact
COPY --from=builder /app/target/*.jar app.jar

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

# JVM options optimized for containers and AWS Graviton (ARM64)
# Performance improvements on Graviton:
# - Reduced compilation overhead with tiered compilation disabled
# - Optimized code cache sizing for reduced memory footprint
# - High-only compilation mode for better throughput on ARM64
# - Reduced compiler thread count optimized for Graviton cores
# These flags are safe and beneficial for both ARM64 and x86 architectures
ENV JAVA_OPTS="-XX:+UseContainerSupport \
    -XX:MaxRAMPercentage=75.0 \
    -XX:InitialRAMPercentage=50.0 \
    -XX:+UseG1GC \
    -XX:+UseStringDeduplication \
    -XX:-TieredCompilation \
    -XX:ReservedCodeCacheSize=64M \
    -XX:InitialCodeCacheSize=64M \
    -XX:CICompilerCount=2 \
    -XX:CompilationMode=high-only"

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
