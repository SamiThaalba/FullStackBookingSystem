package com.no_mercy_no_doubt.tourism_booking.auth.dto;

import jakarta.validation.constraints.*;
import lombok.Builder;

import java.util.Set;

@Builder
public record UserCreateRequest (
    @NotBlank(message = "Username is required.")
     String username,

    @NotBlank(message = "Email is required.")
    @Email(message = "Email format is invalid.")
     String email,

    @NotBlank(message = "Password is required.")
    @Size(min = 8, message = "Password must be at least 8 characters long.")
     String password,

    @NotEmpty(message = "At least one role must be selected.")
    Set<String> roleNames
){}
