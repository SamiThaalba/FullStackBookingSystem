package com.no_mercy_no_doubt.tourism_booking.Recommendation.dto;

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
public class RoomTypeRecommendationResponse {

    private Integer rank;
    private Long id;
    private String name;
    private String description;
    private int capacity;
    private int inventoryCount;
    private BigDecimal basePrice;
    private List<String> amenities;
    private Long hotelId;
    private Integer score;
    private Integer matchedAmenitiesCount;
    private String recommendationReason;
}