package com.no_mercy_no_doubt.tourism_booking.Ai.dto;

import lombok.Data;

@Data
public class AssistantContext {
    private String city;
    /**
     * When true, user explicitly requested "any city / anywhere / all cities".
     * In this mode, city is treated as {@code null}.
     */
    private Boolean anyCity;
    private String checkIn;
    private String checkOut;
    private Integer guests;
    private Long selectedHotelId;
    private String selectedHotelName;
    /** Hotel name the user asked for before we resolve it to {@link #selectedHotelId} (survives short follow-ups like only a city). */
    private String pendingHotelName;
    private Long selectedRoomTypeId;
    private String selectedRoomTypeName;
    private String mode;
    /**
     * Controlled flow step: city -> dates -> guests -> hotels -> hotel -> rooms -> confirm -> payment.
     */
    private String currentStep;
}
