package com.no_mercy_no_doubt.tourism_booking.wishlist.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RoomTypeAlertAsyncTrigger {

    private final AlertService alertService;

    @Async("wishlistAlertsTaskExecutor")
    public void checkAfterRoomUpdate(Long roomTypeId) {
        try {
            alertService.checkAlertsForRoomType(roomTypeId);
        } catch (RuntimeException e) {
            log.error("Background wishlist alert check failed for roomTypeId={}", roomTypeId, e);
        }
    }
}
