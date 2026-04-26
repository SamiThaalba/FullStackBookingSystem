package com.no_mercy_no_doubt.tourism_booking.Ai.dto;

import com.no_mercy_no_doubt.tourism_booking.Ai.service.GroqExtractionService;
import com.no_mercy_no_doubt.tourism_booking.Ai.service.GroqReplyService;
import com.no_mercy_no_doubt.tourism_booking.Recommendation.dto.HotelRecommendationResponse;
import com.no_mercy_no_doubt.tourism_booking.Recommendation.service.RecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RecommendationChatService {

    private final GroqExtractionService groqExtractionService;
    private final RecommendationService recommendationService;
    private final GroqReplyService groqReplyService;

    public RecommendationChatResponse chat(RecommendationChatRequest request) {
        ExtractedRecommendationFilters filters = groqExtractionService.extractFilters(request.getMessage());

        int topN = normalizeTopN(filters.getTopN());

        List<HotelRecommendationResponse> recommendations =
                recommendationService.recommendHotels(
                        filters.getCity(),
                        filters.getMinPrice(),
                        filters.getMaxPrice(),
                        filters.getCapacity(),
                        filters.getAmenities(),
                        topN
                );

        String reply = groqReplyService.generateReply(
                request.getMessage(),
                filters,
                recommendations
        );

        return RecommendationChatResponse.builder()
                .reply(reply)
                .extractedFilters(filters)
                .resultCount(recommendations.size())
                .recommendations(recommendations)
                .build();
    }

    private int normalizeTopN(Integer topN) {
        if (topN == null || topN < 1) {
            return 5;
        }
        return Math.min(topN, 10);
    }
}