# 네이티브 라이브러리 ARM64 호환성 매핑

이 문서는 Java 에코시스템에서 자주 사용되는 네이티브 라이브러리의 ARM64 호환성 정보를 제공합니다.

## 압축 라이브러리

### snappy-java

- **GroupId**: `org.xerial.snappy`
- **ArtifactId**: `snappy-java`
- **ARM64 최소 버전**: 1.1.8.0
- **권장 버전**: 1.1.10.5
- **비고**: 1.1.8.0부터 ARM64 native 지원

**Maven**:
```xml
<dependency>
    <groupId>org.xerial.snappy</groupId>
    <artifactId>snappy-java</artifactId>
    <version>1.1.10.5</version>
</dependency>
```

### lz4-java

- **GroupId**: `org.lz4`
- **ArtifactId**: `lz4-java`
- **ARM64 최소 버전**: 1.8.0
- **권장 버전**: 1.8.0
- **비고**: ARM64 native 지원

**Maven**:
```xml
<dependency>
    <groupId>org.lz4</groupId>
    <artifactId>lz4-java</artifactId>
    <version>1.8.0</version>
</dependency>
```

### zstd-jni

- **GroupId**: `com.github.luben`
- **ArtifactId**: `zstd-jni`
- **ARM64 최소 버전**: 1.5.0-1
- **권장 버전**: 1.5.5-6
- **비고**: ARM64 최적화 포함

**Maven**:
```xml
<dependency>
    <groupId>com.github.luben</groupId>
    <artifactId>zstd-jni</artifactId>
    <version>1.5.5-6</version>
</dependency>
```

## 데이터베이스 드라이버

### rocksdbjni

- **GroupId**: `org.rocksdb`
- **ArtifactId**: `rocksdbjni`
- **ARM64 최소 버전**: 6.22.1
- **권장 버전**: 7.10.2
- **비고**: 7.x 버전 권장, 성능 개선

**Maven**:
```xml
<dependency>
    <groupId>org.rocksdb</groupId>
    <artifactId>rocksdbjni</artifactId>
    <version>7.10.2</version>
</dependency>
```

### sqlite-jdbc

- **GroupId**: `org.xerial`
- **ArtifactId**: `sqlite-jdbc`
- **ARM64 최소 버전**: 3.36.0
- **권장 버전**: 3.44.1.0
- **비고**: 3.36.0부터 ARM64 지원

**Maven**:
```xml
<dependency>
    <groupId>org.xerial</groupId>
    <artifactId>sqlite-jdbc</artifactId>
    <version>3.44.1.0</version>
</dependency>
```

### leveldbjni

- **GroupId**: `org.fusesource.leveldbjni`
- **ArtifactId**: `leveldbjni-all`
- **ARM64 지원**: ❌ 미지원
- **대체 라이브러리**: `org.iq80.leveldb:leveldb` (순수 Java 구현)

**대체 Maven**:
```xml
<!-- leveldbjni 대신 순수 Java 구현 사용 -->
<dependency>
    <groupId>org.iq80.leveldb</groupId>
    <artifactId>leveldb</artifactId>
    <version>0.12</version>
</dependency>
```

## SSL/TLS 라이브러리

### netty-tcnative-boringssl-static

- **GroupId**: `io.netty`
- **ArtifactId**: `netty-tcnative-boringssl-static`
- **ARM64 최소 버전**: 2.0.61.Final
- **권장 버전**: 2.0.61.Final
- **비고**: ARM64 BoringSSL 바이너리 포함

**Maven**:
```xml
<dependency>
    <groupId>io.netty</groupId>
    <artifactId>netty-tcnative-boringssl-static</artifactId>
    <version>2.0.61.Final</version>
</dependency>
```

**대안 - JDK SSL 사용**:
```java
// OpenSSL 대신 JDK SSL 사용
SslContextBuilder.forServer(cert, key)
    .sslProvider(SslProvider.JDK)  // OpenSSL → JDK
    .build();
```

### conscrypt-openjdk

- **GroupId**: `org.conscrypt`
- **ArtifactId**: `conscrypt-openjdk`
- **ARM64 최소 버전**: 2.5.2
- **권장 버전**: 2.5.2
- **비고**: Google의 OpenSSL 기반 보안 프로바이더

**Maven**:
```xml
<dependency>
    <groupId>org.conscrypt</groupId>
    <artifactId>conscrypt-openjdk</artifactId>
    <version>2.5.2</version>
</dependency>
```

## 기타 네이티브 라이브러리

### JNA (Java Native Access)

- **GroupId**: `net.java.dev.jna`
- **ArtifactId**: `jna`
- **ARM64 최소 버전**: 5.6.0
- **권장 버전**: 5.14.0
- **비고**: 5.6.0부터 ARM64 지원

**Maven**:
```xml
<dependency>
    <groupId>net.java.dev.jna</groupId>
    <artifactId>jna</artifactId>
    <version>5.14.0</version>
</dependency>
```

### Bouncy Castle

- **GroupId**: `org.bouncycastle`
- **ArtifactId**: `bcprov-jdk18on`
- **ARM64 지원**: ✅ 완전 호환 (순수 Java)
- **권장 버전**: 1.77
- **비고**: 순수 Java 구현, 아키텍처 독립

**Maven**:
```xml
<dependency>
    <groupId>org.bouncycastle</groupId>
    <artifactId>bcprov-jdk18on</artifactId>
    <version>1.77</version>
</dependency>
```

## 의존성 확인 방법

### Maven 의존성 트리

```bash
mvn dependency:tree | grep -E "(snappy|rocksdb|sqlite|lz4|zstd|netty-tcnative|jna)"
```

### JAR 내 네이티브 라이브러리 확인

```bash
# JAR 파일 내 .so 파일 확인
find . -name "*.jar" -exec sh -c 'unzip -l {} 2>/dev/null | grep -E "\.so$"' \;
```

### 아키텍처별 네이티브 라이브러리 확인

```bash
# ARM64 라이브러리 존재 여부
unzip -l dependency.jar | grep -E "(aarch64|arm64)"
```

## 변환 우선순위

| 우선순위 | 라이브러리 | 이유 |
|----------|------------|------|
| 높음 | rocksdbjni, snappy-java | Kafka, 캐시 등에서 자주 사용 |
| 높음 | netty-tcnative | 네트워크 서버에서 필수 |
| 중간 | sqlite-jdbc, lz4-java | 특정 앱에서 사용 |
| 낮음 | jna | 직접 네이티브 호출 시에만 |
