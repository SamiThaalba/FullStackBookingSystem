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
public class HotelAnalyticsResponse {
    private Long hotelId;
    private String hotelName;
    private long totalBookings;
    private long pendingBookings;
    private long confirmedBookings;
    private long cancelledBookings;
    private BigDecimal totalRevenue;
    private RoomBookingInsight mostBookedRoom;
    private RoomBookingInsight leastBookedRoom;
    private List<RoomPerformanceResponse> rooms;
}