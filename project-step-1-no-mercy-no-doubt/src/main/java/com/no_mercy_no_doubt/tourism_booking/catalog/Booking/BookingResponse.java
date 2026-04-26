package com.no_mercy_no_doubt.tourism_booking.catalog.Booking;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class BookingResponse {
    private Long id;
    private Long hotelId;
    private Long roomTypeId;
    private Long guestId;
    private LocalDate startDate;
    private LocalDate endDate;
    private BookingStatus status;

    private BigDecimal totalPrice;
}