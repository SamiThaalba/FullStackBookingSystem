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
public class HotelRecommendationResponse {

    private Integer rank;
    private Long hotelId;
    private String hotelName;
    private String city;
    private String country;
    private Integer score;
    private Integer matchingRoomCount;
    private Integer maxCapacity;
    private BigDecimal startingPrice;
    private List<String> matchedAmenities;
    private String recommendationReason;
}