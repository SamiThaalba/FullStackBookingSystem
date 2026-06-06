package com.no_mercy_no_doubt.tourism_booking.auth.dto;

import jakarta.validation.constraints.Size;

/**
 * Body for {@code PATCH /api/me/avatar}. Send {@code null} or empty string to clear the photo.
 */
public record AvatarUrlRequest(
        @Size(max = 2048)
        String avatarUrl
) {}
