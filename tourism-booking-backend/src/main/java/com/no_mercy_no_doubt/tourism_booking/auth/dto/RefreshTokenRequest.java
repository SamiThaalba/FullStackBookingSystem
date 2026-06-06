package com.no_mercy_no_doubt.tourism_booking.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RefreshTokenRequest {

    @NotBlank(message = "Refresh token is required.")
    private String refreshToken;
}