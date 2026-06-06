package com.no_mercy_no_doubt.tourism_booking.DynamicPricing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;

public interface PricingRuleRepository extends JpaRepository<PricingRule, Long> {

    @Query("""
        SELECT p FROM PricingRule p
        WHERE p.roomTypeId = :roomTypeId
        AND p.active = true
        AND :date BETWEEN p.startDate AND p.endDate
    """)
    List<PricingRule> findActiveRules(Long roomTypeId, LocalDate date);
}