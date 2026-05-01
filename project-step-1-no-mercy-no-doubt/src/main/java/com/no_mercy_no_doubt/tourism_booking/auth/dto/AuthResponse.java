package com.no_mercy_no_doubt.tourism_booking.auth.dto;

import lombok.Builder;

@Builder
public record AuthResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresInSeconds,
        String email
) {}

