package com.no_mercy_no_doubt.tourism_booking.Ai.service;

import com.no_mercy_no_doubt.tourism_booking.Ai.dto.ExtractedRecommendationFilters;
import com.no_mercy_no_doubt.tourism_booking.Recommendation.dto.HotelRecommendationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class GroqReplyService {

    private final GroqClientService groqClientService;

    public String generateReply(
            String userMessage,
            ExtractedRecommendationFilters filters,
            List<HotelRecommendationResponse> recommendations
    ) {
        if (recommendations == null || recommendations.isEmpty()) {
            return "I couldn’t find a good match for your request. Try changing the city, budget, or amenities.";
        }

        String systemPrompt = """
                You are a hotel booking assistant.

                Write a helpful, natural response based ONLY on the provided recommendation results.

                Rules:
                - Do not invent hotels, prices, ratings, or amenities.
                - Mention only hotels from the provided data.
                - Keep the reply clear and short.
                - Highlight the best options first.
                """;

        StringBuilder prompt = new StringBuilder();
        prompt.append("User message:\n").append(userMessage).append("\n\n");
        prompt.append("Extracted filters:\n");
        prompt.append("city=").append(filters.getCity()).append("\n");
        prompt.append("minPrice=").append(filters.getMinPrice()).append("\n");
        prompt.append("maxPrice=").append(filters.getMaxPrice()).append("\n");
        prompt.append("capacity=").append(filters.getCapacity()).append("\n");
        prompt.append("amenities=").append(filters.getAmenities()).append("\n\n");

        prompt.append("Recommendations:\n");
        for (HotelRecommendationResponse rec : recommendations) {
            prompt.append("- hotelName=").append(rec.getHotelName()).append("\n");
            prompt.append("  city=").append(rec.getCity()).append("\n");
            prompt.append("  country=").append(rec.getCountry()).append("\n");
            prompt.append("  score=").append(rec.getScore()).append("\n");
            prompt.append("  startingPrice=").append(Objects.toString(rec.getStartingPrice(), "")).append("\n");
            prompt.append("  maxCapacity=").append(rec.getMaxCapacity()).append("\n");
            prompt.append("  matchedAmenities=").append(rec.getMatchedAmenities()).append("\n");
            prompt.append("  recommendationReason=").append(rec.getRecommendationReason()).append("\n\n");
        }

        return groqClientService.chat(systemPrompt, prompt.toString());
    }
}