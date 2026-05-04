package com.no_mercy_no_doubt.tourism_booking.Ai.dto;

import com.no_mercy_no_doubt.tourism_booking.Recommendation.dto.HotelRecommendationResponse;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AssistantChatResponse {
    private String reply;
    private String intent;
    private AssistantContext context;
    private List<String> missingFields;
    private AssistantActionPlan action;
    private List<HotelRecommendationResponse> recommendations;
}
