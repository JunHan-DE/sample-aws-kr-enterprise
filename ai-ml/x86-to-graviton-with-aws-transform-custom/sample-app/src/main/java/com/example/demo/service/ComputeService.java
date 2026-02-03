package com.example.demo.service;

import com.example.demo.model.BenchmarkResult;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Service for compute-intensive operations and benchmarking.
 * Used to compare performance between x86 and Graviton architectures.
 */
@Service
public class ComputeService {

    private final SystemInfoService systemInfoService;

    public ComputeService(SystemInfoService systemInfoService) {
        this.systemInfoService = systemInfoService;
    }

    /**
     * Runs a CPU benchmark with mathematical operations.
     *
     * @param iterations Number of iterations to perform
     * @return Benchmark results with timing information
     */
    public BenchmarkResult runBenchmark(int iterations) {
        long startTime = System.nanoTime();

        double result = 0;
        for (int i = 0; i < iterations; i++) {
            result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
        }

        long endTime = System.nanoTime();
        long durationMs = (endTime - startTime) / 1_000_000;

        double opsPerSecond = durationMs > 0 ? (double) iterations / durationMs * 1000 : 0;

        return new BenchmarkResult(
            "CPU Benchmark",
            iterations,
            durationMs,
            opsPerSecond,
            systemInfoService.getSystemInfo().architectureType(),
            result
        );
    }

    /**
     * Calculates prime numbers using Sieve of Eratosthenes.
     * Good for testing integer-heavy operations.
     */
    public BenchmarkResult calculatePrimes(int limit) {
        long startTime = System.nanoTime();

        List<Integer> primes = sieveOfEratosthenes(limit);

        long endTime = System.nanoTime();
        long durationMs = (endTime - startTime) / 1_000_000;

        return new BenchmarkResult(
            "Prime Calculation",
            limit,
            durationMs,
            primes.size(),
            systemInfoService.getSystemInfo().architectureType(),
            primes.size()
        );
    }

    private List<Integer> sieveOfEratosthenes(int limit) {
        boolean[] isComposite = new boolean[limit + 1];
        List<Integer> primes = new ArrayList<>();

        for (int i = 2; i <= limit; i++) {
            if (!isComposite[i]) {
                primes.add(i);
                for (int j = i * 2; j <= limit; j += i) {
                    isComposite[j] = true;
                }
            }
        }

        return primes;
    }
}
