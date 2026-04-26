package com.no_mercy_no_doubt.tourism_booking.AvailabilityPricing.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

@Schema(description = "Availability and price response")
public record AvailabilityCheckResponse (

    @Schema(description = "Whether the room type is available for the given criteria")
    boolean available,

    @Schema(description = "Total price for the stay (if available)")
    BigDecimal totalPrice,

    @Schema(description = "Response message")
    String message
) {}
