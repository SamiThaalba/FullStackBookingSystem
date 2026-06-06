package com.no_mercy_no_doubt.tourism_booking.auth.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.LinkedHashSet;
import java.util.Set;

@Data
public class UpdateRolePermissionsRequest {
    @NotNull(message = "permissionIds is required (use empty array to clear all).")
    private Set<Long> permissionIds = new LinkedHashSet<>();
}