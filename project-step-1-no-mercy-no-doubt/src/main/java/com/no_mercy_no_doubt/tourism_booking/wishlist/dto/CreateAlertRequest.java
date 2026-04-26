package com.no_mercy_no_doubt.tourism_booking.wishlist.dto;

import com.no_mercy_no_doubt.tourism_booking.wishlist.enums.AlertType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateAlertRequest(
        @NotNull Long roomTypeId,
        @NotNull AlertType alertType,
        BigDecimal targetPrice,
        LocalDate checkIn,
        LocalDate checkOut,
        @Positive(message = "Guest count must be at least 1.") Integer guestCount
) {
}