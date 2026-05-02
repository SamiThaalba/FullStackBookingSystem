package com.no_mercy_no_doubt.tourism_booking.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record UiLanguageRequest(@NotBlank String language) {}
