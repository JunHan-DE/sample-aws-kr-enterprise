package com.example.demo.controller;

import com.example.demo.model.BenchmarkResult;
import com.example.demo.service.ComputeService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/**
 * Controller for compute-intensive operations.
 * Used to benchmark and compare performance between x86 and Graviton.
 */
@RestController
@RequestMapping("/api/compute")
@Validated
public class ComputeController {

    private final ComputeService computeService;

    public ComputeController(ComputeService computeService) {
        this.computeService = computeService;
    }

    /**
     * Executes CPU benchmark to compare architecture performance.
     *
     * @param iterations Number of iterations for the benchmark (1-1000000)
     * @return Benchmark results including execution time and architecture info
     */
    @GetMapping("/benchmark")
    public ResponseEntity<BenchmarkResult> runBenchmark(
            @RequestParam(defaultValue = "10000")
            @Min(1) @Max(1000000) int iterations) {
        return ResponseEntity.ok(computeService.runBenchmark(iterations));
    }

    /**
     * Calculates prime numbers up to the specified limit.
     * Good for CPU-bound performance testing.
     */
    @GetMapping("/primes/{limit}")
    public ResponseEntity<BenchmarkResult> calculatePrimes(
            @PathVariable @Min(1) @Max(100000) int limit) {
        return ResponseEntity.ok(computeService.calculatePrimes(limit));
    }
}
