package com.no_mercy_no_doubt.tourism_booking.Ai.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class ExtractedRecommendationFilters {
    private String city;
    private BigDecimal minPrice;
    private BigDecimal maxPrice;
    private Integer capacity;
    private List<String> amenities;
    private Integer topN;
}