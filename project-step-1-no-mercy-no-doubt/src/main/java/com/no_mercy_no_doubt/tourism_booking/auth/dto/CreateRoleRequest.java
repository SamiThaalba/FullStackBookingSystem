package com.no_mercy_no_doubt.tourism_booking.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateRoleRequest {
    @NotBlank(message = "Role name is required.")
    private String name;

    @NotBlank(message = "Role description is required.")
    private String description;
}