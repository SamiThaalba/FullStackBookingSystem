package com.no_mercy_no_doubt.tourism_booking.Ai.dto;

import com.no_mercy_no_doubt.tourism_booking.Recommendation.dto.HotelRecommendationResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecommendationChatResponse {
    private String reply;
    private ExtractedRecommendationFilters extractedFilters;
    private Integer resultCount;
    private List<HotelRecommendationResponse> recommendations;
}