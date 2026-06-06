package com.no_mercy_no_doubt.tourism_booking.notification.dto;

import java.time.LocalDateTime;

public record NotificationResponse(
        Long id,
        String title,
        String message,
        boolean read,
        LocalDateTime createdAt
) {
}