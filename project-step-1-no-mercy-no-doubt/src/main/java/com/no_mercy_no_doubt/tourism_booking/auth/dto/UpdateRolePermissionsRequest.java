package com.no_mercy_no_doubt.tourism_booking.auth.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.Set;

@Data
public class UpdateRolePermissionsRequest {
    @NotEmpty(message = "At least one permission must be selected.")
    private Set<String> permissionNames;
}