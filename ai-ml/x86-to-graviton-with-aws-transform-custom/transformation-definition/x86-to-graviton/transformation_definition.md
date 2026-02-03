# x86 to AWS Graviton (ARM64) Transformation Definition

## Overview

This transformation converts x86-based Java applications to be compatible with AWS Graviton (ARM64) processors. It handles JVM options, native library dependencies, Docker configurations, and build settings.

## Transformation Goals

1. Remove x86-specific JVM options
2. Add ARM64-optimized JVM options
3. Update native library dependencies to ARM64-compatible versions
4. Configure multi-architecture Docker builds
5. Update build configurations for ARM64 support

---

## Transformation Rules

### Rule 1: JVM Options - Remove x86-Specific Options

**Context**: x86 processors support specific instruction sets (AVX, SSE, etc.) that are not available on ARM64. These JVM options must be removed.

**Find patterns**:
- `-XX:+UseAVX`
- `-XX:+UseAVX2`
- `-XX:+UseAVX512`
- `-XX:+UseSHA` (x86-specific acceleration)
- `-XX:+UseAES` (x86-specific acceleration)
- `-XX:UseSSE=N` (any value of N)
- `-XX:+UseSSE42`

**Action**: Remove these options from:
- Dockerfile `ENTRYPOINT` or `CMD`
- `JAVA_OPTS` environment variables
- Shell scripts (`.sh` files)
- Application configuration files

**Example**:
```diff
# Before
- JAVA_OPTS="-Xmx2g -XX:+UseAVX2 -XX:+UseSHA"
# After
+ JAVA_OPTS="-Xmx2g"
```

---

### Rule 2: JVM Options - Add ARM64-Optimized Options

**Context**: Graviton processors benefit from specific JVM optimizations.

**Add options** (if not already present):
- `-XX:+UseG1GC` - Recommended GC for Graviton
- `-XX:+UseContainerSupport` - For containerized environments
- `-XX:+UseNUMA` - For multi-socket Graviton instances

**Recommended options** (suggest but don't force):
- `-XX:+AlwaysPreTouch` - Reduce memory allocation latency
- `-XX:+UseTransparentHugePages` - Reduce TLB misses

**Example**:
```diff
# Before
- ENV JAVA_OPTS="-Xmx2g"
# After
+ ENV JAVA_OPTS="-Xmx2g -XX:+UseG1GC -XX:+UseContainerSupport"
```

---

### Rule 3: Native Library Dependencies - Version Upgrades

**Context**: Some Java libraries include native code that must be compiled for ARM64. Older versions may not include ARM64 binaries.

**Dependency mapping**:

| Library | Minimum ARM64 Version | Recommended Version |
|---------|----------------------|---------------------|
| `org.xerial.snappy:snappy-java` | 1.1.8.0 | 1.1.10.5 |
| `org.rocksdb:rocksdbjni` | 6.22.1 | 7.10.2 |
| `org.xerial:sqlite-jdbc` | 3.36.0 | 3.44.1.0 |
| `org.lz4:lz4-java` | 1.8.0 | 1.8.0 |
| `com.github.luben:zstd-jni` | 1.5.0-1 | 1.5.5-6 |
| `io.netty:netty-tcnative-boringssl-static` | 2.0.61.Final | 2.0.61.Final |
| `net.java.dev.jna:jna` | 5.6.0 | 5.14.0 |
| `org.conscrypt:conscrypt-openjdk` | 2.5.2 | 2.5.2 |

**Action for Maven (pom.xml)**:
```xml
<!-- If version is below minimum, upgrade to recommended -->
<dependency>
    <groupId>org.xerial.snappy</groupId>
    <artifactId>snappy-java</artifactId>
    <version>1.1.10.5</version> <!-- Upgraded for ARM64 -->
</dependency>
```

**Action for Gradle (build.gradle)**:
```groovy
// If version is below minimum, upgrade to recommended
implementation 'org.xerial.snappy:snappy-java:1.1.10.5' // Upgraded for ARM64
```

---

### Rule 4: Dockerfile - Multi-Architecture Support

**Context**: Docker images should support both x86_64 and ARM64 for flexibility.

**Transformation for Dockerfile**:

1. **Add platform arguments**:
```dockerfile
# Add at the beginning
ARG TARGETPLATFORM
ARG TARGETARCH
ARG BUILDPLATFORM
```

2. **Use platform-aware base images**:
```diff
# Before
- FROM openjdk:17-jdk-slim
# After
+ FROM --platform=$TARGETPLATFORM eclipse-temurin:17-jre
```

3. **Add architecture labels**:
```dockerfile
LABEL architecture="${TARGETARCH}"
LABEL platform="${TARGETPLATFORM}"
```

4. **Update ENTRYPOINT to use architecture-neutral JVM options**:
```diff
# Before
- ENTRYPOINT ["java", "-XX:+UseAVX", "-jar", "app.jar"]
# After
+ ENV JAVA_OPTS="-XX:+UseG1GC -XX:+UseContainerSupport"
+ ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```

---

### Rule 5: Build Configuration - Multi-Architecture

**Context**: Build systems should be configured to produce artifacts for both architectures.

**For Maven (pom.xml)** - Add profile for ARM64:
```xml
<profiles>
    <profile>
        <id>arm64</id>
        <properties>
            <os.arch>aarch64</os.arch>
        </properties>
    </profile>
</profiles>
```

**For Docker builds** - Use buildx:
```bash
# Build command suggestion
docker buildx build --platform linux/amd64,linux/arm64 -t myapp:latest .
```

---

### Rule 6: Code Patterns - Architecture Detection

**Context**: If code contains hardcoded architecture checks, update them to handle ARM64.

**Find patterns**:
```java
// Hardcoded x86 assumptions
if (arch.equals("amd64") || arch.equals("x86_64")) {
    // x86 specific code
}
```

**Transform to**:
```java
// Support both architectures
String arch = System.getProperty("os.arch").toLowerCase();
if (arch.contains("amd64") || arch.contains("x86_64")) {
    // x86 specific code
} else if (arch.contains("aarch64") || arch.contains("arm64")) {
    // ARM64 specific code
}
```

---

## Files to Transform

| File Pattern | Rules Applied |
|--------------|---------------|
| `Dockerfile` | Rule 1, 2, 4 |
| `docker-compose.yml` | Rule 4 |
| `pom.xml` | Rule 3, 5 |
| `build.gradle` | Rule 3, 5 |
| `*.sh` (shell scripts) | Rule 1, 2 |
| `application.yml` / `application.properties` | Rule 1, 2 |
| `*.java` | Rule 6 |

---

## Validation Checks

After transformation, verify:

1. **Build succeeds**: `mvn clean package` or `gradle build`
2. **Tests pass**: `mvn test` or `gradle test`
3. **Docker builds for ARM64**: `docker buildx build --platform linux/arm64 .`
4. **Application starts**: Health check endpoint responds
5. **Architecture detected correctly**: `/api/system-info` returns correct architecture

---

## Out of Scope

This transformation does NOT handle:

- Complete code rewrites for native libraries
- JNI code modifications
- Assembly code translations
- Performance tuning beyond JVM options

For these cases, manual intervention is required.
