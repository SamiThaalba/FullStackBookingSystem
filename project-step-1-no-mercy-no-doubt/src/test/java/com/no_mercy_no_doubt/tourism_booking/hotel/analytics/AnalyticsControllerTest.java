package com.no_mercy_no_doubt.tourism_booking.hotel.analytics;

import com.no_mercy_no_doubt.tourism_booking.analytics.controller.AnalyticsController;
import com.no_mercy_no_doubt.tourism_booking.analytics.dto.HotelAnalyticsResponse;
import com.no_mercy_no_doubt.tourism_booking.analytics.dto.ManagerDashboardResponse;
import com.no_mercy_no_doubt.tourism_booking.analytics.dto.RoomPerformanceResponse;
import com.no_mercy_no_doubt.tourism_booking.analytics.service.AnalyticsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AnalyticsControllerTest {

    private MockMvc mockMvc;
    private AnalyticsService analyticsService;

    @BeforeEach
    void setUp() {
        analyticsService = Mockito.mock(AnalyticsService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new AnalyticsController(analyticsService)).build();
    }

    @Test
    void getManagerDashboard_returnsDashboard() throws Exception {
        Mockito.when(analyticsService.getManagerDashboard(3L))
                .thenReturn(ManagerDashboardResponse.builder().managerId(3L).totalBookings(8).totalRevenue(new BigDecimal("500.00")).build());

        mockMvc.perform(get("/api/managers/3/dashboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.managerId").value(3))
                .andExpect(jsonPath("$.totalBookings").value(8));
    }

    @Test
    void getHotelAnalytics_returnsAnalytics() throws Exception {
        Mockito.when(analyticsService.getHotelAnalytics(9L))
                .thenReturn(HotelAnalyticsResponse.builder().hotelId(9L).hotelName("Grand Hotel").confirmedBookings(5).build());

        mockMvc.perform(get("/api/hotels/9/analytics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hotelId").value(9))
                .andExpect(jsonPath("$.hotelName").value("Grand Hotel"));
    }

    @Test
    void getRoomPerformance_returnsList() throws Exception {
        Mockito.when(analyticsService.getRoomPerformance(9L))
                .thenReturn(List.of(RoomPerformanceResponse.builder().roomTypeId(4L).roomTypeName("Suite").totalBookings(12).build()));

        mockMvc.perform(get("/api/hotels/9/rooms/performance"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].roomTypeId").value(4))
                .andExpect(jsonPath("$[0].roomTypeName").value("Suite"));
    }
}
