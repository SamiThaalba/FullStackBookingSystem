package com.no_mercy_no_doubt.tourism_booking.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreatePermissionRequest {
    @NotBlank(message = "Permission name is required.")
    private String name;

    @NotBlank(message = "Permission description is required.")
    private String description;
}