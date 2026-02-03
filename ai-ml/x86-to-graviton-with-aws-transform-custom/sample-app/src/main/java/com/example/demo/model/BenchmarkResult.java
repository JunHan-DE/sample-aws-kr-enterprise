package com.example.demo.model;

/**
 * Benchmark result record for performance comparison.
 */
public record BenchmarkResult(
    String testName,
    int iterations,
    long durationMs,
    double operationsPerSecond,
    String architecture,
    double resultValue
) {
}
