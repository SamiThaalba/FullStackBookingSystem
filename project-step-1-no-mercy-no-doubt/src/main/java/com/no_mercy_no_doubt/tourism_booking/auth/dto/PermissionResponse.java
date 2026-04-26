package com.no_mercy_no_doubt.tourism_booking.auth.dto;

import lombok.Builder;

@Builder
public record PermissionResponse(
        Long id,
        String name,
        String description
) {}