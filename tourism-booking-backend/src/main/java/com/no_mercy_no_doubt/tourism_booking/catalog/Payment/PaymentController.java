package com.no_mercy_no_doubt.tourism_booking.catalog.Payment;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping
    @PreAuthorize("hasAuthority('payment:create')")
    public ResponseEntity<PaymentResponse> createPayment(@Valid @RequestBody PaymentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(paymentService.createPayment(request));
    }

    @PostMapping("/{paymentId}/process")
    @PreAuthorize("hasAuthority('payment:update')")
    public ResponseEntity<PaymentResponse> processPayment(
            @PathVariable Long paymentId,
            @RequestParam boolean success) {

        return ResponseEntity.ok(paymentService.processPayment(paymentId, success));
    }
}