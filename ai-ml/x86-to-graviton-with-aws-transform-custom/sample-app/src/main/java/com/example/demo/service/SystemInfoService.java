package com.example.demo.service;

import com.example.demo.model.SystemInfo;
import org.springframework.stereotype.Service;

/**
 * Service for retrieving system and architecture information.
 */
@Service
public class SystemInfoService {

    /**
     * Collects current system information including architecture details.
     * This is essential for verifying successful Graviton migration.
     */
    public SystemInfo getSystemInfo() {
        Runtime runtime = Runtime.getRuntime();

        return new SystemInfo(
            System.getProperty("os.name"),
            System.getProperty("os.arch"),
            System.getProperty("os.version"),
            System.getProperty("java.version"),
            System.getProperty("java.vendor"),
            System.getProperty("java.vm.name"),
            runtime.availableProcessors(),
            runtime.maxMemory(),
            runtime.totalMemory(),
            runtime.freeMemory(),
            detectArchitectureType()
        );
    }

    /**
     * Detects whether running on x86 or ARM architecture.
     */
    private String detectArchitectureType() {
        String arch = System.getProperty("os.arch", "unknown").toLowerCase();

        if (arch.contains("aarch64") || arch.contains("arm64") || arch.contains("arm")) {
            return "ARM64 (Graviton)";
        } else if (arch.contains("amd64") || arch.contains("x86_64") || arch.contains("x86")) {
            return "x86_64 (Intel/AMD)";
        } else {
            return "Unknown: " + arch;
        }
    }
}
