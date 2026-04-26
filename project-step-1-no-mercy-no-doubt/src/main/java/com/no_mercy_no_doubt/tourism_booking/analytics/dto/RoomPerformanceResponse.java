package com.no_mercy_no_doubt.tourism_booking.analytics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomPerformanceResponse {
    private Long roomTypeId;
    private String roomTypeName;
    private int inventoryCount;
    private long pendingBookings;
    private long confirmedBookings;
    private long cancelledBookings;
    private long totalBookings;
    private BigDecimal generatedRevenue;
}