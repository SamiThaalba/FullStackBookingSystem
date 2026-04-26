package com.no_mercy_no_doubt.tourism_booking.catalog.Payment;

import com.no_mercy_no_doubt.tourism_booking.catalog.Booking.Booking;
import org.springframework.stereotype.Component;

import static org.springframework.http.ResponseEntity.status;
@Component
public class PaymentMapper {
    public Payment toEntity(PaymentRequest req, Booking booking) {
        return Payment.builder()
                .status(PaymentStatus.PENDING)
                .booking(booking)
                .build();
    }

    public PaymentResponse ToDto(Payment payment) {
        return PaymentResponse.builder().bookingId(payment.getBooking().getId()).id(payment.getId()).status(payment.getStatus()).build();
    }
}
