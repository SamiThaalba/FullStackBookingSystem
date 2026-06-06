package com.no_mercy_no_doubt.tourism_booking.catalog.Payment;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PaymentRequest {

    @NotNull
    private Long bookingId;
}