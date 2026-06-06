package com.no_mercy_no_doubt.tourism_booking.wishlist.dto;

import com.no_mercy_no_doubt.tourism_booking.wishlist.enums.AlertType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record AlertResponse(
        Long id,
        Long roomTypeId,
        String roomTypeName,
        String hotelName,
        AlertType alertType,
        BigDecimal targetPrice,
        LocalDate checkIn,
        LocalDate checkOut,
        Integer guestCount,
        boolean active,
        boolean triggered,
        LocalDateTime createdAt,
        LocalDateTime lastTriggeredAt
) {
}