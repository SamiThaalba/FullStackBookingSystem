package com.no_mercy_no_doubt.tourism_booking.catalog.Payment;

import com.no_mercy_no_doubt.tourism_booking.catalog.Booking.Booking;
import jakarta.persistence.*;
import lombok.*;

@Builder
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
public class Payment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "booking_id", referencedColumnName = "id", unique = true)
    private Booking booking;

    @Column(nullable = false, precision = 12, scale = 2)
    private java.math.BigDecimal amount;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentStatus status;

}
