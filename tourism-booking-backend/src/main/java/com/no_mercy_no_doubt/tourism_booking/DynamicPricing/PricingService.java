package com.no_mercy_no_doubt.tourism_booking.DynamicPricing;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PricingService {

    private final PricingRuleRepository pricingRuleRepository;

    public double getMultiplier(Long roomTypeId, LocalDate date) {
        List<PricingRule> rules =
                pricingRuleRepository.findActiveRules(roomTypeId, date);

        if (rules.isEmpty()) return 1.0;

        return rules.stream()
                .mapToDouble(PricingRule::getMultiplier)
                .max()
                .orElse(1.0);
    }
}