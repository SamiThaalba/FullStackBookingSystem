package com.no_mercy_no_doubt.tourism_booking.wishlist.schedule;

import com.no_mercy_no_doubt.tourism_booking.wishlist.service.AlertService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Isolated scheduler bean so polling can be disabled in environments where multiple replicas would
 * duplicate work (use distributed locks or a single scheduler instance in that case).
 */
@Component
@ConditionalOnProperty(name = "app.wishlist.alerts.scheduler-enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
@Slf4j
public class WishlistAlertScheduler {

    private final AlertService alertService;

    @Scheduled(fixedDelayString = "${app.wishlist.alerts.poll-interval-ms:300000}")
    public void pollAlerts() {
        try {
            alertService.runScheduledPoll();
        } catch (Exception e) {
            log.error("Wishlist alert scheduled poll aborted", e);
        }
    }
}
