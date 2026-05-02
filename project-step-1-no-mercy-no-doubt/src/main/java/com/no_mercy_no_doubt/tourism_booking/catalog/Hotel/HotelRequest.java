package com.no_mercy_no_doubt.tourism_booking.catalog.Hotel;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
@Schema(description = "Request to create or update a hotel")
public class HotelRequest {

    @NotBlank(message = "Hotel name is required.")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private String name;

    private String description;
    private String imageUrl;

    @NotBlank(message = "Address is required.")
    private String address;

    private String city;
    private String country;

    /** Optional map pin (decimal degrees). */
    private Double latitude;
    /** Optional map pin (decimal degrees). */
    private Double longitude;

    private String phone;
    private String email;

    @Positive(message = "Manager id must be greater than zero.")
    private Long managerId;
}