package com.no_mercy_no_doubt.tourism_booking.Ai.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class AssistantChatRequest {

    @NotBlank(message = "Message is required.")
    private String message;

    @Valid
    private AssistantContext context = new AssistantContext();

    @Valid
    private List<AssistantTurn> history = new ArrayList<>();
}
