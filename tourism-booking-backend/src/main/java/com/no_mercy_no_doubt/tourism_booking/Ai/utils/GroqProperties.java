package com.no_mercy_no_doubt.tourism_booking.Ai.utils;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Data
@Validated
@ConfigurationProperties(prefix = "app.groq")
public class GroqProperties {

    @NotBlank
    private String apiKey;

    @NotBlank
    private String baseUrl = "https://api.groq.com/openai/v1";

    @NotBlank
    private String model = "llama-3.3-70b-versatile";

    @NotNull
    private Double temperature = 0.4;

    @NotNull
    private Integer maxTokens = 500;
}