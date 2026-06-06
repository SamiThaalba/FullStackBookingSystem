package com.no_mercy_no_doubt.tourism_booking.wishlist.service;

import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.catalog.Booking.BookingRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomType;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeRepository;
import com.no_mercy_no_doubt.tourism_booking.common.utils.CurrentUserProvider;
import com.no_mercy_no_doubt.tourism_booking.notification.service.AlertEmailNotifier;
import com.no_mercy_no_doubt.tourism_booking.wishlist.dto.AlertResponse;
import com.no_mercy_no_doubt.tourism_booking.wishlist.dto.CreateAlertRequest;
import com.no_mercy_no_doubt.tourism_booking.wishlist.entity.PriceAvailabilityAlert;
import com.no_mercy_no_doubt.tourism_booking.wishlist.enums.AlertType;
import com.no_mercy_no_doubt.tourism_booking.wishlist.messaging.WishlistTriggeredAlertVariants;
import com.no_mercy_no_doubt.tourism_booking.wishlist.repository.PriceAvailabilityAlertRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class AlertService {

    private final PriceAvailabilityAlertRepository alertRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final BookingRepository bookingRepository;
    private final CurrentUserProvider currentUserProvider;
    private final AlertEmailNotifier alertEmailNotifier;

    @Qualifier("wishlistRequiresNewTransactionTemplate")
    private final TransactionTemplate wishlistRequiresNewTransactionTemplate;

    @Transactional(readOnly = true)
    public List<AlertResponse> myAlerts() {
        AppUser user = currentUserProvider.getCurrentUser();
        return alertRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public AlertResponse create(CreateAlertRequest request) {
        AppUser user = currentUserProvider.getCurrentUser();
        validateRequest(request);

        RoomType roomType = roomTypeRepository.findById(request.roomTypeId())
                .orElseThrow(() -> new EntityNotFoundException("Room type was not found."));

        Integer guestCountForStore = request.alertType() == AlertType.AVAILABLE_NOW
                ? (request.guestCount() != null ? request.guestCount() : 1)
                : null;

        PriceAvailabilityAlert alert = PriceAvailabilityAlert.builder()
                .user(user)
                .roomType(roomType)
                .alertType(request.alertType())
                .targetPrice(request.targetPrice())
                .checkIn(request.alertType() == AlertType.AVAILABLE_NOW ? request.checkIn() : null)
                .checkOut(request.alertType() == AlertType.AVAILABLE_NOW ? request.checkOut() : null)
                .guestCount(guestCountForStore)
                .active(true)
                .triggered(false)
                .createdAt(LocalDateTime.now())
                .build();

        alertRepository.save(alert);

        return toResponse(alert);
    }

    public AlertResponse activate(Long alertId) {
        AppUser user = currentUserProvider.getCurrentUser();
        PriceAvailabilityAlert alert = alertRepository.findByIdAndUserId(alertId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Alert was not found."));

        alert.setActive(true);
        alert.setTriggered(false);
        return toResponse(alert);
    }

    public AlertResponse deactivate(Long alertId) {
        AppUser user = currentUserProvider.getCurrentUser();
        PriceAvailabilityAlert alert = alertRepository.findByIdAndUserId(alertId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Alert was not found."));

        alert.setActive(false);
        return toResponse(alert);
    }

    /**
     * Called after booking lifecycle events that may free inventory for a room type.
     */
    public void checkAlertsForRoomType(Long roomTypeId) {
        List<PriceAvailabilityAlert> alerts =
                alertRepository.findByRoomTypeIdAndActiveTrueWithAssociations(roomTypeId);

        for (PriceAvailabilityAlert alert : alerts) {
            if (!alert.isTriggered() && shouldTrigger(alert)) {
                try {
                    wishlistRequiresNewTransactionTemplate.executeWithoutResult(status ->
                            processEventDrivenAlert(alert.getId()));
                } catch (Exception e) {
                    log.error("Event-driven alert processing failed roomTypeId={} alertId={}",
                            roomTypeId, alert.getId(), e);
                }
            }
        }
    }

    /**
     * Periodic scan for price and availability conditions. Each alert is processed in its own transaction.
     */
    public void runScheduledPoll() {
        List<Long> ids = alertRepository.findIdsByActiveTrueAndTriggeredFalse();
        for (Long id : ids) {
            try {
                wishlistRequiresNewTransactionTemplate.executeWithoutResult(status ->
                        processScheduledAlert(id));
            } catch (Exception e) {
                log.error("Scheduled alert processing failed alertId={}", id, e);
            }
        }
    }

    private void processScheduledAlert(Long alertId) {
        alertRepository.findByIdWithAssociations(alertId).ifPresent(alert -> {
            if (!alert.isActive() || alert.isTriggered()) {
                return;
            }
            if (shouldTrigger(alert)) {
                triggerAlert(alert);
            }
        });
    }

    private void processEventDrivenAlert(Long alertId) {
        alertRepository.findByIdWithAssociations(alertId).ifPresent(alert -> {
            if (!alert.isActive() || alert.isTriggered()) {
                return;
            }
            if (shouldTrigger(alert)) {
                triggerAlert(alert);
            }
        });
    }

    private void validateRequest(CreateAlertRequest request) {
        if (request.alertType() == AlertType.PRICE_BELOW) {
            if (request.targetPrice() == null || request.targetPrice().signum() <= 0) {
                throw new IllegalArgumentException("Target price must be greater than zero for price alerts.");
            }
            if (request.checkIn() != null || request.checkOut() != null || request.guestCount() != null) {
                throw new IllegalArgumentException("Check-in, check-out, and guest count must be omitted for price alerts.");
            }
        }

        if (request.alertType() == AlertType.AVAILABLE_NOW) {
            if (request.targetPrice() != null) {
                throw new IllegalArgumentException("Target price must be omitted for availability alerts.");
            }
            if (request.checkIn() == null || request.checkOut() == null) {
                throw new IllegalArgumentException("Check-in and check-out dates are required for availability alerts.");
            }
            if (!request.checkOut().isAfter(request.checkIn())) {
                throw new IllegalArgumentException("Check-out date must be after check-in date.");
            }
            if (request.checkIn().isBefore(LocalDate.now())) {
                throw new IllegalArgumentException("Check-in date cannot be in the past.");
            }
            int guests = request.guestCount() != null ? request.guestCount() : 1;
            if (guests < 1) {
                throw new IllegalArgumentException("Guest count must be at least 1.");
            }
        }
    }

    private boolean shouldTrigger(PriceAvailabilityAlert alert) {
        RoomType roomType = alert.getRoomType();

        return switch (alert.getAlertType()) {
            case PRICE_BELOW -> roomType.getBasePrice() != null
                    && roomType.getBasePrice().compareTo(alert.getTargetPrice()) <= 0;
            case AVAILABLE_NOW -> isRoomTypeAvailableForAlert(roomType, alert);
        };
    }

    private boolean isRoomTypeAvailableForAlert(RoomType roomType, PriceAvailabilityAlert alert) {
        if (alert.getCheckIn() == null || alert.getCheckOut() == null) {
            return false;
        }
        if (!alert.getCheckOut().isAfter(alert.getCheckIn())) {
            return false;
        }
        int guests = alert.getGuestCount() != null ? alert.getGuestCount() : 1;
        if (guests < 1 || guests > roomType.getCapacity()) {
            return false;
        }

        long overlapping = bookingRepository.countActiveOverlappingBookings(
                roomType.getId(),
                alert.getCheckIn(),
                alert.getCheckOut()
        );

        return overlapping < roomType.getInventoryCount();
    }

    private void triggerAlert(PriceAvailabilityAlert alert) {
        alert.setTriggered(true);
        alert.setLastTriggeredAt(LocalDateTime.now());

        String hotelName = alert.getRoomType().getHotel() != null
                ? alert.getRoomType().getHotel().getName()
                : "Unknown hotel";

        WishlistTriggeredAlertVariants variants =
                alert.getAlertType() == AlertType.PRICE_BELOW
                        ? WishlistTriggeredAlertVariants.forPriceBelow(
                                alert.getRoomType().getName(), hotelName, alert.getTargetPrice())
                        : WishlistTriggeredAlertVariants.forAvailability(
                                alert.getRoomType().getName(),
                                hotelName,
                                alert.getCheckIn(),
                                alert.getCheckOut(),
                                alert.getGuestCount() != null ? alert.getGuestCount() : 1);

        WishlistTriggeredAlertVariants.NotificationPair inApp =
                variants.notificationFor(alert.getUser());
        alertEmailNotifier.notifyWishlistAlertTriggered(
                alert.getUser(),
                inApp.title(),
                inApp.message(),
                variants.emailSubject(),
                variants.emailBody());
    }

    private AlertResponse toResponse(PriceAvailabilityAlert alert) {
        return new AlertResponse(
                alert.getId(),
                alert.getRoomType().getId(),
                alert.getRoomType().getName(),
                alert.getRoomType().getHotel() != null ? alert.getRoomType().getHotel().getName() : null,
                alert.getAlertType(),
                alert.getTargetPrice(),
                alert.getCheckIn(),
                alert.getCheckOut(),
                alert.getGuestCount(),
                alert.isActive(),
                alert.isTriggered(),
                alert.getCreatedAt(),
                alert.getLastTriggeredAt()
        );
    }
}
