package com.no_mercy_no_doubt.tourism_booking.Ai.dto;

import lombok.Data;

@Data
public class AssistantContext {
    private String city;
    private String checkIn;
    private String checkOut;
    private Integer guests;
    private Long selectedHotelId;
    private String selectedHotelName;
    private String mode;
}
