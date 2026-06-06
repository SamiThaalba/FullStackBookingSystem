package com.no_mercy_no_doubt.tourism_booking.Ai.utils;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(GroqProperties.class)
public class GroqConfig {

    @Bean
    public RestClient groqRestClient(GroqProperties groqProperties) {
        return RestClient.builder()
                .baseUrl(groqProperties.getBaseUrl())
                .defaultHeader("Authorization", "Bearer " + groqProperties.getApiKey())
                .defaultHeader("Content-Type", "application/json")
                .build();
    }
}