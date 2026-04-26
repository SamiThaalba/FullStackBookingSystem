package com.no_mercy_no_doubt.tourism_booking.hotel.notification.controller;

import com.no_mercy_no_doubt.tourism_booking.notification.controller.NotificationController;
import com.no_mercy_no_doubt.tourism_booking.notification.dto.NotificationResponse;
import com.no_mercy_no_doubt.tourism_booking.notification.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class NotificationControllerTest {

    private MockMvc mockMvc;
    private NotificationService notificationService;

    @BeforeEach
    void setUp() {
        notificationService = Mockito.mock(NotificationService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new NotificationController(notificationService)).build();
    }

    @Test
    void myNotifications_returnsList() throws Exception {
        Mockito.when(notificationService.myNotifications())
                .thenReturn(List.of(new NotificationResponse(1L, "Booking confirmed", "Your booking is confirmed", false, LocalDateTime.of(2026, 4, 1, 10, 0))));

        mockMvc.perform(get("/api/notifications"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].title").value("Booking confirmed"));
    }

    @Test
    void markAsRead_returnsNotification() throws Exception {
        Mockito.when(notificationService.markAsRead(1L))
                .thenReturn(new NotificationResponse(1L, "Booking confirmed", "Your booking is confirmed", true, LocalDateTime.of(2026, 4, 1, 10, 0)));

        mockMvc.perform(patch("/api/notifications/1/read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.read").value(true));
    }

    @Test
    void markAllAsRead_returnsNoContent() throws Exception {
        mockMvc.perform(patch("/api/notifications/read-all"))
                .andExpect(status().isNoContent());

        Mockito.verify(notificationService).markAllAsRead();
    }

    @Test
    void unreadCount_returnsMap() throws Exception {
        Mockito.when(notificationService.unreadCount()).thenReturn(4L);

        mockMvc.perform(get("/api/notifications/unread-count"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(4));
    }
}
