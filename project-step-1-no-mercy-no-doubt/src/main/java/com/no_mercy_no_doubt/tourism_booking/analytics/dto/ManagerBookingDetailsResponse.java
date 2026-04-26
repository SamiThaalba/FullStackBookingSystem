package com.no_mercy_no_doubt.tourism_booking.analytics.dto;

import com.no_mercy_no_doubt.tourism_booking.catalog.Booking.BookingStatus;
import com.no_mercy_no_doubt.tourism_booking.catalog.Payment.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManagerBookingDetailsResponse {
    private Long bookingId;
    private Long guestId;
    private String guestName;
    private String guestEmail;
    private Long hotelId;
    private String hotelName;
    private Long roomTypeId;
    private String roomTypeName;
    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal totalPrice;
    private BookingStatus bookingStatus;
    private PaymentStatus paymentStatus;
    private LocalDateTime createdAt;
}