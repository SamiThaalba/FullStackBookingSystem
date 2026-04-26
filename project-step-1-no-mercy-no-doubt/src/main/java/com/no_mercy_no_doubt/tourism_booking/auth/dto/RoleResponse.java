package com.no_mercy_no_doubt.tourism_booking.auth.dto;

import lombok.Builder;

import java.util.Set;

@Builder
public record RoleResponse(
        Long id,
        String name,
        String description,
        Set<String> permissions
) {}