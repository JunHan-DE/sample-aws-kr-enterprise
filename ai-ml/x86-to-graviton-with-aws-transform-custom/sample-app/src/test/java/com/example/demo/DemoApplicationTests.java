package com.example.demo;

import com.example.demo.model.SystemInfo;
import com.example.demo.service.SystemInfoService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class DemoApplicationTests {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private SystemInfoService systemInfoService;

    @Test
    void contextLoads() {
        // Verify application context loads successfully
    }

    @Test
    void healthEndpointReturnsOk() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "http://localhost:" + port + "/api/health",
            String.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("OK");
    }

    @Test
    void systemInfoEndpointReturnsArchitecture() {
        ResponseEntity<SystemInfo> response = restTemplate.getForEntity(
            "http://localhost:" + port + "/api/system-info",
            SystemInfo.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().osArch()).isNotEmpty();
        assertThat(response.getBody().architectureType()).isNotEmpty();
    }

    @Test
    void systemInfoServiceDetectsArchitecture() {
        SystemInfo info = systemInfoService.getSystemInfo();

        assertThat(info.architectureType()).isNotNull();
        assertThat(info.architectureType()).containsAnyOf("ARM64", "x86_64", "Unknown");
    }

    @Test
    void benchmarkEndpointWorks() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "http://localhost:" + port + "/api/compute/benchmark?iterations=100",
            String.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
