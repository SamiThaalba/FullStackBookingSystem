package com.no_mercy_no_doubt.tourism_booking.analytics.controller;

import com.no_mercy_no_doubt.tourism_booking.analytics.service.AnalyticsService;
import com.no_mercy_no_doubt.tourism_booking.analytics.dto.HotelAnalyticsResponse;
import com.no_mercy_no_doubt.tourism_booking.analytics.dto.ManagerDashboardResponse;
import com.no_mercy_no_doubt.tourism_booking.analytics.dto.RoomPerformanceResponse;
import com.no_mercy_no_doubt.tourism_booking.analytics.dto.UserActivityLogResponse;
import com.no_mercy_no_doubt.tourism_booking.analytics.service.UserActivityLogService;
import com.no_mercy_no_doubt.tourism_booking.common.dto.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final UserActivityLogService userActivityLogService;

    @GetMapping("/managers/{managerId}/dashboard")
    @PreAuthorize("hasAuthority('analytics:view')")
    public ResponseEntity<ManagerDashboardResponse> getManagerDashboard(@PathVariable Long managerId) {
        return ResponseEntity.ok(analyticsService.getManagerDashboard(managerId));
    }

    @GetMapping("/hotels/{hotelId}/analytics")
    @PreAuthorize("hasAuthority('analytics:view')")
    public ResponseEntity<HotelAnalyticsResponse> getHotelAnalytics(@PathVariable Long hotelId) {
        return ResponseEntity.ok(analyticsService.getHotelAnalytics(hotelId));
    }

    @GetMapping("/hotels/{hotelId}/rooms/performance")
    @PreAuthorize("hasAuthority('analytics:view')")
    public ResponseEntity<List<RoomPerformanceResponse>> getRoomPerformance(@PathVariable Long hotelId) {
        return ResponseEntity.ok(analyticsService.getRoomPerformance(hotelId));
    }

    @GetMapping("/admin/activity-logs")
    @PreAuthorize("hasAuthority('role:manage')")
    public ResponseEntity<PageResponse<UserActivityLogResponse>> getActivityLogs(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String actionType,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(userActivityLogService.getLogs(userId, actionType, fromDate, toDate, page, size));
    }
}