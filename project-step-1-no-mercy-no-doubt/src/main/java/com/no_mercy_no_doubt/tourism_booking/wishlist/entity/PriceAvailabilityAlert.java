package com.no_mercy_no_doubt.tourism_booking.wishlist.entity;

import com.no_mercy_no_doubt.tourism_booking.wishlist.enums.AlertType;
import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomType;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "price_availability_alerts"
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PriceAvailabilityAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_type_id", nullable = false)
    private RoomType roomType;

    @Enumerated(EnumType.STRING)
    @Column(name = "alert_type", nullable = false, length = 40)
    private AlertType alertType;

    @Column(name = "target_price", precision = 10, scale = 2)
    private BigDecimal targetPrice;

    /** Set for AVAILABLE_NOW alerts; null for price-only alerts. */
    @Column(name = "check_in")
    private LocalDate checkIn;

    @Column(name = "check_out")
    private LocalDate checkOut;

    @Column(name = "guest_count")
    private Integer guestCount;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(nullable = false)
    @Builder.Default
    private boolean triggered = false;

    @Column(name = "last_triggered_at")
    private LocalDateTime lastTriggeredAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;
}