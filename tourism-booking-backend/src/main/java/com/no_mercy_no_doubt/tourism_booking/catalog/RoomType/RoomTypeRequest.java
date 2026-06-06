package com.no_mercy_no_doubt.tourism_booking.catalog.RoomType;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Schema(description = "Request to create or update a room type")
public class RoomTypeRequest {

    @NotBlank(message = "Room type name is required.")
    private String name;

    private String description;

    @Schema(description = "Optional public image URL for this room type")
    private String imageUrl;

    @NotNull
    @Min(1)
    @Schema(description = "Maximum guests")
    private Integer capacity;

    @NotNull
    @Min(1)
    @Schema(description = "Number of rooms of this type")
    private Integer inventoryCount;

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal basePrice;

    private List<String> amenities;
    private Long hotelId;
}
