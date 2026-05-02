package com.no_mercy_no_doubt.tourism_booking.catalog.Hotel;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Positive;

@Schema(description = "Request to partially update a hotel")
public record HotelPatchRequest(

        String name,

        String description,

        String imageUrl,

        String address,

        String city,

        String country,

        Double latitude,

        Double longitude,

        String phone,

        @Email(message = "Email format is invalid.")
        String email,

        @Positive(message = "Manager id must be greater than zero.")
        Long managerId

) {}