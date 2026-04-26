package com.no_mercy_no_doubt.tourism_booking.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Set;

@Data
public class UserUpdateRequest {
    @NotBlank(message = "Email is required.")
    @Email(message = "Email format is invalid.")
    private String email;


    @NotEmpty(message = "At least one role must be selected.")
    private Set<String> roleNames;

    @NotNull(message = "Blocked status is required.")
    private Boolean blocked;
}
