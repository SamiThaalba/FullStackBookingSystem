package com.no_mercy_no_doubt.tourism_booking.notification.controller;

import com.no_mercy_no_doubt.tourism_booking.notification.dto.NotificationResponse;
import com.no_mercy_no_doubt.tourism_booking.notification.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Tag(name = "Notifications", description = "In-app notifications from triggered alerts")
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    @Operation(summary = "List notifications for the current user")
    public List<NotificationResponse> myNotifications() {
        return notificationService.myNotifications();
    }

    @PatchMapping("/{id}/read")
    @Operation(summary = "Mark one notification as read")
    public NotificationResponse markAsRead(@PathVariable Long id) {
        return notificationService.markAsRead(id);
    }

    @PatchMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Mark all notifications as read")
    public void markAllAsRead() {
        notificationService.markAllAsRead();
    }

    @GetMapping("/unread-count")
    @Operation(summary = "Unread notification count")
    public Map<String, Long> unreadCount() {
        return Map.of("unreadCount", notificationService.unreadCount());
    }
}