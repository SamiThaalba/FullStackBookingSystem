package com.no_mercy_no_doubt.tourism_booking.Recommendation.controller;

import com.no_mercy_no_doubt.tourism_booking.Recommendation.service.RecommendationService;
import com.no_mercy_no_doubt.tourism_booking.Recommendation.dto.RoomTypeRecommendationResponse;
import com.no_mercy_no_doubt.tourism_booking.Recommendation.dto.HotelRecommendationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/recommendations")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('recommendation:view')")
public class RecommendationController {

    private final RecommendationService recommendationService;

    @GetMapping("/hotels")
    public ResponseEntity<List<HotelRecommendationResponse>> recommendHotels(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Integer capacity,
            @RequestParam(required = false) List<String> amenities,
            @RequestParam(defaultValue = "5") Integer topN
    ) {
        return ResponseEntity.ok(
                recommendationService.recommendHotels(city, minPrice, maxPrice, capacity, amenities, topN)
        );
    }

    @GetMapping("/room-types")
    public ResponseEntity<List<RoomTypeRecommendationResponse>> recommendRoomTypes(
            @RequestParam Integer guestCount,
            @RequestParam(required = false) BigDecimal budget,
            @RequestParam(required = false) List<String> amenities,
            @RequestParam(defaultValue = "5") Integer topN
    ) {
        return ResponseEntity.ok(
                recommendationService.recommendRoomTypes(guestCount, budget, amenities, topN)
        );
    }
}