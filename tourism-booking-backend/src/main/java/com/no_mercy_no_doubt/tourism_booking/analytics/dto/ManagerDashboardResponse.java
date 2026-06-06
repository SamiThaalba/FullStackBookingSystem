package com.no_mercy_no_doubt.tourism_booking.analytics.dto;
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
public class ManagerDashboardResponse {
    private Long managerId;
    private long hotelsCount;
    private long totalBookings;
    private long pendingBookings;
    private long confirmedBookings;
    private long cancelledBookings;
    private BigDecimal totalRevenue;
    private List<ManagerHotelSummaryResponse> hotels;
    private List<ManagerBookingDetailsResponse> recentBookings;
    private List<ManagerBookingDetailsResponse> pendingBookingsList;
    private List<ManagerBookingDetailsResponse> upcomingBookings;
}