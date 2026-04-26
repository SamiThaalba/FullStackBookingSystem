package com.no_mercy_no_doubt.tourism_booking.catalog.RoomType;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Room type response")
public class RoomTypeResponse {

    private Long id;
    private String name;
    private String description;
    private int capacity;
    private int inventoryCount;
    private BigDecimal basePrice;
    private List<String> amenities;
    private Long hotelId;
}
