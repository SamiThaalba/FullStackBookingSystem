package com.no_mercy_no_doubt.tourism_booking.AvailabilityPricing.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

@Schema(description = "Request to check availability and get price")
public record AvailabilityCheckRequest(

    @Schema(description = "Room type ID", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull Long roomTypeId,

    @Schema(description = "Check-in date", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull LocalDate checkIn,

    @Schema(description = "Check-out date", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull LocalDate checkOut,

    @Schema(description = "Number of guests", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull @Min(1) Integer numberOfGuests)
{}
