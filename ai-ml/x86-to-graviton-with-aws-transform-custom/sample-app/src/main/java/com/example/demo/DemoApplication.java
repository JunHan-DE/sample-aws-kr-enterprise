package com.example.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Sample Spring Boot application for x86 to Graviton migration demonstration.
 *
 * This application serves as a reference implementation showing:
 * - Architecture-agnostic Java code
 * - Proper dependency management for ARM64 compatibility
 * - Health checks and metrics for migration validation
 */
@SpringBootApplication
public class DemoApplication {

    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
