package com.no_mercy_no_doubt.tourism_booking.Ai.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AssistantTurn {
    @NotBlank
    private String role;
    @NotBlank
    private String content;
}
