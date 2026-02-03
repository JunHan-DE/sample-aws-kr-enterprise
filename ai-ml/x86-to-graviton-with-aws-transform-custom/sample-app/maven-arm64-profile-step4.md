# Maven ARM64 Build Profile - Step 4

## Overview
This document describes the ARM64-specific Maven build profile added to pom.xml to enable architecture-aware builds and deployment for AWS Graviton instances.

## Profile Configuration

### Profile ID
```xml
<profile>
    <id>arm64</id>
</profile>
```
**Name**: arm64
**Purpose**: Groups all ARM64-specific build configurations

### Automatic Activation
```xml
<activation>
    <os>
        <arch>aarch64</arch>
    </os>
</activation>
```
**Trigger**: Automatically activates when `os.arch` system property equals `aarch64`
**Detection**: Maven detects the build system architecture at runtime
**Benefit**: No manual profile activation required on ARM64 systems

**Activation Scenarios**:
- ✅ Building on AWS Graviton EC2 instances (c7g, m7g, r7g families)
- ✅ Building on Apple Silicon M1/M2/M3 Macs (reports as aarch64)
- ✅ Building on ARM64 Linux systems
- ❌ Does NOT activate on x86/amd64 systems (profile remains inactive)

## Architecture-Specific Properties

### Native Architecture Property
```xml
<native.arch>aarch64</native.arch>
```
**Purpose**: Identifies the native CPU architecture for the build
**Usage**: Can be referenced in build plugins that require architecture identification
**Value**: `aarch64` (the standard Linux/Unix name for ARM64)

### Platform Architecture Property
```xml
<platform.architecture>arm64</platform.architecture>
```
**Purpose**: Platform-friendly architecture name
**Usage**: Can be used in container builds, deployment scripts, or artifact classifiers
**Value**: `arm64` (common in Docker, Kubernetes contexts)

### Build Architecture Property
```xml
<build.architecture>ARM64 (Graviton)</build.architecture>
```
**Purpose**: Human-readable architecture description
**Usage**: Can be displayed in build logs, application metadata, or deployment documentation
**Value**: `ARM64 (Graviton)` - clearly indicates Graviton compatibility

## Java Version Enforcement

### Maven Enforcer Plugin Configuration
```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-enforcer-plugin</artifactId>
    <version>3.4.1</version>
    <executions>
        <execution>
            <id>enforce-java-version</id>
            <goals>
                <goal>enforce</goal>
            </goals>
            <configuration>
                <rules>
                    <requireJavaVersion>
                        <version>[17,)</version>
                        <message>ARM64 builds require Java 17 or higher for optimal compatibility</message>
                    </requireJavaVersion>
                </rules>
            </configuration>
        </execution>
    </executions>
</plugin>
```

**Purpose**: Validates that ARM64 builds use Java 17 or higher
**Enforcement**: Build fails with clear error message if Java version < 17
**Rationale**: 
- Java 17 is the minimum LTS version with comprehensive ARM64 support
- Eclipse Temurin 17 provides optimized ARM64 JDK builds
- Graviton-specific JVM optimizations are designed for Java 17+

**Error Message**: "ARM64 builds require Java 17 or higher for optimal compatibility"

## Profile Behavior

### When Profile is Active (ARM64 System)
1. **Properties Set**:
   - `native.arch` = aarch64
   - `platform.architecture` = arm64
   - `build.architecture` = ARM64 (Graviton)

2. **Java Version Check**: 
   - Enforcer plugin validates Java 17+ before build proceeds
   - Build fails early if Java version is incompatible

3. **Build Logging**:
   - Maven logs will show: `[INFO] Activated profiles: arm64`
   - Clear indication that ARM64 optimizations are in effect

### When Profile is Inactive (x86 System)
1. **Properties**: Not set (profile inactive)
2. **Enforcer Plugin**: Not executed
3. **Build Behavior**: Standard Spring Boot build (unchanged)
4. **Compatibility**: No impact on existing x86 build workflows

## Profile Activation Verification

### On ARM64 System
```bash
# Check active profiles
mvn help:active-profiles

# Expected output:
# Active Profiles for Project 'com.example:graviton-demo:jar:1.0.0':
# The following profiles are active:
#  - arm64 (source: com.example:graviton-demo:1.0.0)
```

### On x86 System
```bash
# Check active profiles
mvn help:active-profiles

# Expected output:
# Active Profiles for Project 'com.example:graviton-demo:jar:1.0.0':
# There are no active profiles.
```

### Force Profile Activation (Testing)
```bash
# Manually activate profile on any system
mvn clean package -Parm64

# This allows testing ARM64 profile configuration on x86 systems
```

## Integration with Spring Boot Build

### Seamless Integration
- ✅ Profile works alongside Spring Boot Maven Plugin
- ✅ Does not interfere with Spring Boot's auto-configuration
- ✅ Properties can be accessed by Spring Boot build process
- ✅ No changes required to application.properties or application.yml

### Artifact Building
- Standard JAR artifact produced (no architecture-specific suffix needed)
- JAR is architecture-neutral (pure Java bytecode)
- JVM optimizations applied at runtime in Dockerfile

## Use Cases

### 1. CI/CD Pipeline Integration
```yaml
# GitHub Actions example
- name: Build on ARM64 runner
  run: mvn clean package
  # Profile automatically activates on ARM64 runner
```

### 2. Architecture Detection in Plugins
```xml
<plugin>
    <configuration>
        <architecture>${native.arch}</architecture>
    </configuration>
</plugin>
```

### 3. Conditional Plugin Execution
```xml
<plugin>
    <executions>
        <execution>
            <phase>package</phase>
            <goals><goal>arm64-optimize</goal></goals>
        </execution>
    </executions>
</plugin>
<!-- Only runs when arm64 profile is active -->
```

### 4. Deployment Metadata
Properties can be injected into application:
```java
@Value("${build.architecture:Unknown}")
private String buildArchitecture;
```

## Benefits

### 1. Zero-Configuration Detection
- Developers don't need to remember profile activation
- CI/CD pipelines work seamlessly on both architectures
- Reduces human error in build configurations

### 2. Architecture Awareness
- Build system knows it's compiling for ARM64
- Enables future ARM64-specific optimizations
- Provides clear build logs for troubleshooting

### 3. Java Version Safety
- Prevents accidental builds with incompatible Java versions
- Fails fast with clear error messages
- Ensures Graviton optimizations are available

### 4. Non-Intrusive for x86
- x86 builds are completely unaffected
- No performance overhead when inactive
- Maintains backward compatibility

## Verification Checklist

- ✅ Profile defined with id "arm64"
- ✅ Profile activates on os.arch=aarch64
- ✅ ARM64-specific properties configured:
  - native.arch=aarch64
  - platform.architecture=arm64
  - build.architecture=ARM64 (Graviton)
- ✅ Maven enforcer plugin validates Java 17+
- ✅ Profile seamlessly integrates with Spring Boot plugin
- ✅ x86 build behavior unchanged (profile inactive)
- ✅ Documentation comments explain profile purpose

## Future Enhancements

### Potential Extensions (Not Currently Implemented)
1. **ARM64-Specific Tests**: Run additional test suites only on ARM64
2. **Performance Profiling**: Enable ARM64-specific profiling during builds
3. **Artifact Classification**: Add ARM64 classifier to JAR artifacts
4. **Native Image Support**: GraalVM native image builds for ARM64
5. **Resource Optimization**: ARM64-specific resource bundling

### Not Required for Current Transformation
- Current implementation provides foundation for architecture awareness
- Additional features can be added based on specific requirements
- Focus remains on compatibility validation, not feature expansion

## Compatibility Notes

### Maven Version
- Requires Maven 3.0+ (profile activation by os.arch)
- Tested with Maven 3.8.x and 3.9.x
- Spring Boot parent manages compatible Maven plugin versions

### Operating Systems
- ✅ Linux ARM64 (AWS Graviton, Raspberry Pi, etc.)
- ✅ macOS ARM64 (Apple Silicon M1/M2/M3)
- ✅ Windows ARM64 (Windows on ARM)
- ❌ x86/amd64 systems (profile inactive, as designed)

## Conclusion

The ARM64 Maven build profile provides:
1. **Automatic detection** of ARM64 build environments
2. **Architecture-specific properties** for build customization
3. **Java version enforcement** for Graviton compatibility
4. **Zero impact** on x86 build workflows
5. **Foundation** for future ARM64-specific build enhancements

This profile enables seamless multi-architecture builds without manual configuration while ensuring ARM64 builds meet the requirements for optimal AWS Graviton performance.
