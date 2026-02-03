package com.example.demo.model;

/**
 * System information record for architecture verification.
 */
public record SystemInfo(
    String osName,
    String osArch,
    String osVersion,
    String javaVersion,
    String javaVendor,
    String jvmName,
    int availableProcessors,
    long maxMemory,
    long totalMemory,
    long freeMemory,
    String architectureType
) {
}
