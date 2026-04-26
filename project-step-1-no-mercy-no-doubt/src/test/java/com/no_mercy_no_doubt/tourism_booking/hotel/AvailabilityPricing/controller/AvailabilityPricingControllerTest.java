package com.no_mercy_no_doubt.tourism_booking.hotel.AvailabilityPricing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.no_mercy_no_doubt.tourism_booking.AvailabilityPricing.controller.AvailabilityPricingController;
import com.no_mercy_no_doubt.tourism_booking.AvailabilityPricing.dto.AvailabilityCheckResponse;
import com.no_mercy_no_doubt.tourism_booking.AvailabilityPricing.service.AvailabilityPricingService;
import com.no_mercy_no_doubt.tourism_booking.catalog.Booking.BookingRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomType;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AvailabilityPricingControllerTest {

    private MockMvc mockMvc;
    private RoomTypeRepository roomTypeRepository;
    private BookingRepository bookingRepository;
    private AvailabilityPricingService availabilityPricingService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        roomTypeRepository = Mockito.mock(RoomTypeRepository.class);
        bookingRepository = Mockito.mock(BookingRepository.class);
        availabilityPricingService = Mockito.mock(AvailabilityPricingService.class);
        objectMapper = new ObjectMapper().findAndRegisterModules();

        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders.standaloneSetup(
                        new AvailabilityPricingController(roomTypeRepository, bookingRepository, availabilityPricingService))
                .setValidator(validator)
                .build();
    }

    @Test
    void getAvailableRooms_returnsAvailableRooms() throws Exception {
        Mockito.when(roomTypeRepository.findAll()).thenReturn(List.of(new RoomType()));
        Mockito.when(availabilityPricingService.getAvailableRooms(
                ArgumentMatchers.anyList(),
                ArgumentMatchers.eq(LocalDate.of(2026, 5, 1)),
                ArgumentMatchers.eq(LocalDate.of(2026, 5, 3)),
                ArgumentMatchers.eq(2),
                ArgumentMatchers.any()))
                .thenReturn(List.of(RoomTypeResponse.builder().id(1L).name("Deluxe").capacity(2).build()));

        mockMvc.perform(get("/api/availability")
                        .param("from", "2026-05-01")
                        .param("to", "2026-05-03")
                        .param("guests", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].name").value("Deluxe"));
    }

    @Test
    void checkAvailability_returnsPrice() throws Exception {
        RoomType roomType = new RoomType();
        roomType.setId(2L);
        roomType.setCapacity(3);
        roomType.setInventoryCount(5);
        roomType.setBasePrice(new BigDecimal("120.00"));

        Mockito.when(roomTypeRepository.findById(2L)).thenReturn(Optional.of(roomType));
        Mockito.when(bookingRepository.countActiveOverlappingBookings(2L, LocalDate.of(2026, 5, 10), LocalDate.of(2026, 5, 12)))
                .thenReturn(1L);
        Mockito.when(availabilityPricingService.checkAvailability(
                new BigDecimal("120.00"), 3, 5,
                LocalDate.of(2026, 5, 10), LocalDate.of(2026, 5, 12), 2, 1L))
                .thenReturn(new AvailabilityCheckResponse(true, new BigDecimal("240.00"), "Available"));

        mockMvc.perform(post("/api/availability/check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  \"roomTypeId\": 2,
                                  \"checkIn\": \"2026-05-10\",
                                  \"checkOut\": \"2026-05-12\",
                                  \"numberOfGuests\": 2
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.message").value("Available"));
    }

    @Test
    void checkAvailability_returnsBadRequest_whenGuestsInvalid() throws Exception {
        mockMvc.perform(post("/api/availability/check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  \"roomTypeId\": 2,
                                  \"checkIn\": \"2026-05-10\",
                                  \"checkOut\": \"2026-05-12\",
                                  \"numberOfGuests\": 0
                                }
                                """))
                .andExpect(status().isBadRequest());
    }
}
