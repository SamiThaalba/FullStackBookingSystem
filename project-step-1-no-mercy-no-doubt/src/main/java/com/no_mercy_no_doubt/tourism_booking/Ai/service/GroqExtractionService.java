package com.no_mercy_no_doubt.tourism_booking.Ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.no_mercy_no_doubt.tourism_booking.Ai.dto.ExtractedRecommendationFilters;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GroqExtractionService {

    private final GroqClientService groqClientService;
    private final ObjectMapper objectMapper;

    public ExtractedRecommendationFilters extractFilters(String userMessage) {
        String systemPrompt = """
                You extract hotel search filters from user messages.

                Return ONLY valid JSON.
                Do not return markdown.
                Do not explain anything.

                JSON schema:
                {
                  "city": "string or null",
                  "minPrice": number or null,
                  "maxPrice": number or null,
                  "capacity": number or null,
                  "amenities": ["string"],
                  "topN": number or null
                }
                """;

        String rawJson = groqClientService.chat(systemPrompt, userMessage);

        try {
            return objectMapper.readValue(rawJson, ExtractedRecommendationFilters.class);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to process AI response.", e);
        }
    }
}