package com.example.demo.controller;

import com.example.demo.model.SystemInfo;
import com.example.demo.service.SystemInfoService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Health and system information controller.
 * Provides endpoints to verify application health and architecture information.
 */
@RestController
@RequestMapping("/api")
public class HealthController {

    private final SystemInfoService systemInfoService;

    public HealthController(SystemInfoService systemInfoService) {
        this.systemInfoService = systemInfoService;
    }

    /**
     * Returns current system architecture information.
     * Useful for verifying Graviton migration success.
     */
    @GetMapping("/system-info")
    public ResponseEntity<SystemInfo> getSystemInfo() {
        return ResponseEntity.ok(systemInfoService.getSystemInfo());
    }

    /**
     * Simple health check endpoint.
     */
    @GetMapping("/health")
    public ResponseEntity<String> healthCheck() {
        return ResponseEntity.ok("OK");
    }
}
