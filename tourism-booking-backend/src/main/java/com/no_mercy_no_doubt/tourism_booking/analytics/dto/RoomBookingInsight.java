package com.no_mercy_no_doubt.tourism_booking.analytics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomBookingInsight {
    private Long roomTypeId;
    private String roomTypeName;
    private long bookingCount;
}