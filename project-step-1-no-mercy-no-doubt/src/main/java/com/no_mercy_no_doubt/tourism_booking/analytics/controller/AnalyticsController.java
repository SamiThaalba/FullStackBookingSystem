package com.no_mercy_no_doubt.tourism_booking.analytics.controller;

import com.no_mercy_no_doubt.tourism_booking.analytics.service.AnalyticsService;
import com.no_mercy_no_doubt.tourism_booking.analytics.dto.HotelAnalyticsResponse;
import com.no_mercy_no_doubt.tourism_booking.analytics.dto.ManagerDashboardResponse;
import com.no_mercy_no_doubt.tourism_booking.analytics.dto.RoomPerformanceResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
@PreAuthorize("hasAuthority('analytics:view')")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/managers/{managerId}/dashboard")
    public ResponseEntity<ManagerDashboardResponse> getManagerDashboard(@PathVariable Long managerId) {
        return ResponseEntity.ok(analyticsService.getManagerDashboard(managerId));
    }

    @GetMapping("/hotels/{hotelId}/analytics")
    public ResponseEntity<HotelAnalyticsResponse> getHotelAnalytics(@PathVariable Long hotelId) {
        return ResponseEntity.ok(analyticsService.getHotelAnalytics(hotelId));
    }

    @GetMapping("/hotels/{hotelId}/rooms/performance")
    public ResponseEntity<List<RoomPerformanceResponse>> getRoomPerformance(@PathVariable Long hotelId) {
        return ResponseEntity.ok(analyticsService.getRoomPerformance(hotelId));
    }
}