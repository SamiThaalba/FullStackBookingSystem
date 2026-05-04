package com.no_mercy_no_doubt.tourism_booking.Ai.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AssistantActionPlan {
    private String type;
    private String city;
    private String checkIn;
    private String checkOut;
    private Integer guests;
    private Long hotelId;
    private String hotelName;
}
