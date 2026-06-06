package com.no_mercy_no_doubt.tourism_booking.notification.service;

import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.common.utils.CurrentUserProvider;
import com.no_mercy_no_doubt.tourism_booking.notification.dto.NotificationResponse;
import com.no_mercy_no_doubt.tourism_booking.notification.entity.Notification;
import com.no_mercy_no_doubt.tourism_booking.notification.repository.NotificationRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final CurrentUserProvider currentUserProvider;
    private final SimpMessagingTemplate messagingTemplate;

    public void create(AppUser user, String title, String message) {
        Notification notification = Notification.builder()
                .user(user)
                .title(title)
                .message(message)
                .read(false)
                .createdAt(LocalDateTime.now())
                .build();

        Notification saved = notificationRepository.save(notification);

        // Push to the user's websocket queue so the frontend shows slide-in instantly.
        NotificationResponse payload = toResponse(saved);
        String username = user.getUsername();
        if (username == null || username.isBlank()) {
            log.warn("In-app notification id={} saved but websocket skipped: user has no username (userId={})",
                    saved.getId(), user.getId());
            return;
        }
        try {
            messagingTemplate.convertAndSendToUser(username, "/queue/notifications", payload);
            log.debug("Websocket notification push user={} notificationId={}", username, saved.getId());
        } catch (Exception ex) {
            log.warn("Websocket push failed user={} notificationId={} (in-app row still saved)",
                    username, saved.getId(), ex);
        }
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> myNotifications() {
        AppUser user = currentUserProvider.getCurrentUser();

        return notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public NotificationResponse markAsRead(Long notificationId) {
        AppUser user = currentUserProvider.getCurrentUser();

        Notification notification = notificationRepository.findByIdAndUserId(notificationId, user.getId())
                .orElseThrow(() -> new EntityNotFoundException("Notification was not found."));

        notification.setRead(true);
        return toResponse(notification);
    }

    public void markAllAsRead() {
        AppUser user = currentUserProvider.getCurrentUser();
        notificationRepository.markAllReadForUser(user.getId());
    }

    @Transactional(readOnly = true)
    public long unreadCount() {
        AppUser user = currentUserProvider.getCurrentUser();
        return notificationRepository.countByUserIdAndReadFalse(user.getId());
    }

    private NotificationResponse toResponse(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getTitle(),
                notification.getMessage(),
                notification.isRead(),
                notification.getCreatedAt()
        );
    }
}