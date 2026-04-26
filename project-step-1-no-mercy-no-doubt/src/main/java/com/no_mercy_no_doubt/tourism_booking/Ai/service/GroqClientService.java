package com.no_mercy_no_doubt.tourism_booking.Ai.service;

import com.no_mercy_no_doubt.tourism_booking.Ai.utils.GroqProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;

@Service
@RequiredArgsConstructor
public class GroqClientService {

    private final RestClient groqRestClient;
    private final GroqProperties groqProperties;

    public String chat(String systemPrompt, String userPrompt) {
        GroqChatRequest request = new GroqChatRequest(
                groqProperties.getModel(),
                List.of(
                        new GroqMessage("system", systemPrompt),
                        new GroqMessage("user", userPrompt)
                ),
                groqProperties.getTemperature(),
                groqProperties.getMaxTokens(),
                false
        );

        GroqChatResponse response = groqRestClient.post()
                .uri("/chat/completions")
                .body(request)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw new IllegalStateException("AI service request failed.");
                })
                .body(GroqChatResponse.class);

        if (response == null || response.choices() == null || response.choices().isEmpty()) {
            throw new IllegalStateException("AI service returned no response.");
        }

        String content = response.choices().get(0).message().content();
        if (content == null || content.isBlank()) {
            throw new IllegalStateException("AI service returned empty content.");
        }

        return content.trim();
    }

    public record GroqChatRequest(
            String model,
            List<GroqMessage> messages,
            Double temperature,
            Integer max_tokens,
            Boolean stream
    ) {}

    public record GroqMessage(
            String role,
            String content
    ) {}

    public record GroqChatResponse(
            List<GroqChoice> choices
    ) {}

    public record GroqChoice(
            GroqMessage message
    ) {}
}