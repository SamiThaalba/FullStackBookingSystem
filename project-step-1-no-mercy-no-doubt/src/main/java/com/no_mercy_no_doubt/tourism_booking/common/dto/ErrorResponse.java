package com.no_mercy_no_doubt.tourism_booking.common.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Consistent error response DTO for all API endpoints.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(description = "Standard API error response")
public class ErrorResponse {

    @Schema(description = "HTTP status code")
    private int status;

    @Schema(description = "Error type/code")
    private String error;

    @Schema(description = "Human-readable message")
    private String message;

    @Schema(description = "Request path")
    private String path;

    @Schema(description = "Timestamp")
    private Instant timestamp;

    @Schema(description = "Validation errors (field-level)")
    private List<FieldError> fieldErrors;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FieldError {
        private String field;
        private String message;
        private Object rejectedValue;
    }
}
