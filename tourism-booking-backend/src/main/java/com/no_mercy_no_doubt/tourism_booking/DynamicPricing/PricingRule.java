package com.no_mercy_no_doubt.tourism_booking.DynamicPricing;

import jakarta.persistence.*;
import lombok.Data;


import java.time.LocalDate;
@Data
@Entity
@Table(name = "pricing_rules")
public class PricingRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long roomTypeId;

    private LocalDate startDate;
    private LocalDate endDate;

    private Double multiplier;

    private Boolean active;

}