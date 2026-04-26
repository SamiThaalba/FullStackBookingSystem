package com.no_mercy_no_doubt.tourism_booking.hotel.Recommendation;

import com.no_mercy_no_doubt.tourism_booking.Recommendation.controller.RecommendationController;
import com.no_mercy_no_doubt.tourism_booking.Recommendation.dto.HotelRecommendationResponse;
import com.no_mercy_no_doubt.tourism_booking.Recommendation.dto.RoomTypeRecommendationResponse;
import com.no_mercy_no_doubt.tourism_booking.Recommendation.service.RecommendationService;
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

class RecommendationControllerTest {

    private MockMvc mockMvc;
    private RecommendationService recommendationService;

    @BeforeEach
    void setUp() {
        recommendationService = Mockito.mock(RecommendationService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new RecommendationController(recommendationService)).build();
    }

    @Test
    void recommendHotels_returnsRecommendations() throws Exception {
        Mockito.when(recommendationService.recommendHotels("Bethlehem", new BigDecimal("100"), new BigDecimal("300"), 2, List.of("wifi"), 3))
                .thenReturn(List.of(HotelRecommendationResponse.builder().rank(1).hotelId(10L).hotelName("Grand Hotel").build()));

        mockMvc.perform(get("/api/recommendations/hotels")
                        .param("city", "Bethlehem")
                        .param("minPrice", "100")
                        .param("maxPrice", "300")
                        .param("capacity", "2")
                        .param("amenities", "wifi")
                        .param("topN", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].hotelId").value(10))
                .andExpect(jsonPath("$[0].hotelName").value("Grand Hotel"));
    }

    @Test
    void recommendRoomTypes_returnsRecommendations() throws Exception {
        Mockito.when(recommendationService.recommendRoomTypes(2, new BigDecimal("200"), List.of("wifi"), 4))
                .thenReturn(List.of(RoomTypeRecommendationResponse.builder().rank(1).id(7L).name("Suite").build()));

        mockMvc.perform(get("/api/recommendations/room-types")
                        .param("guestCount", "2")
                        .param("budget", "200")
                        .param("amenities", "wifi")
                        .param("topN", "4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(7))
                .andExpect(jsonPath("$[0].name").value("Suite"));
    }
}
