package com.no_mercy_no_doubt.tourism_booking.Ai.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RecommendationChatRequest {

    @NotBlank(message = "Message is required.")
    private String message;
}