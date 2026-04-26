package com.no_mercy_no_doubt.tourism_booking.catalog.Payment;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentResponse {
    private Long id;
    private Long bookingId;
    private double amount;
    private PaymentStatus status;
    private String message;
}
