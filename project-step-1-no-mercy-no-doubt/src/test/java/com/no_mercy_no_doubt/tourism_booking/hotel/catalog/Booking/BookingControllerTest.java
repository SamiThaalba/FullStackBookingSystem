package com.no_mercy_no_doubt.tourism_booking.hotel.catalog.Booking;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.no_mercy_no_doubt.tourism_booking.AvailabilityPricing.dto.AvailabilityCheckResponse;
import com.no_mercy_no_doubt.tourism_booking.catalog.Booking.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class BookingControllerTest {

    private MockMvc mockMvc;
    private BookingService bookingService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        bookingService = Mockito.mock(BookingService.class);
        objectMapper = new ObjectMapper().findAndRegisterModules();

        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders
                .standaloneSetup(new BookingController(bookingService))
                .setValidator(validator)
                .build();
    }

    @Test
    void create_returnsCreatedBooking() throws Exception {
        BookingRequest request = new BookingRequest();
        request.setHotelId(1L);
        request.setRoomTypeId(4L);
        request.setStartDate(LocalDate.of(2099, 6, 1));
        request.setEndDate(LocalDate.of(2099, 6, 3));

        BookingResponse createResponse = new BookingResponse();
        createResponse.setId(1L);
        createResponse.setHotelId(1L);
        createResponse.setRoomTypeId(4L);
        createResponse.setStatus(BookingStatus.PENDING);
        createResponse.setTotalPrice(new BigDecimal("300.00"));

        Mockito.when(bookingService.createBooking(any(BookingRequest.class)))
                .thenReturn(createResponse);

        mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.hotelId").value(1))
                .andExpect(jsonPath("$.roomTypeId").value(4));
    }

    @Test
    void getAllBookings_returnsAll() throws Exception {
        Mockito.when(bookingService.getAllBookings())
                .thenReturn(List.of(bookingResponse(1L, 10L, 4L, BookingStatus.PENDING)));

        mockMvc.perform(get("/api/bookings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1));
    }

    @Test
    void getAllBookings_filtersByStatus() throws Exception {
        Mockito.when(bookingService.getBookingsByStatus(BookingStatus.CONFIRMED))
                .thenReturn(List.of(bookingResponse(2L, 10L, 4L, BookingStatus.CONFIRMED)));

        mockMvc.perform(get("/api/bookings").param("status", "CONFIRMED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("CONFIRMED"));
    }

    @Test
    void getMyBookings_returnsBookings() throws Exception {
        Mockito.when(bookingService.getMyBookings())
                .thenReturn(List.of(bookingResponse(3L, 11L, 5L, BookingStatus.PENDING)));

        mockMvc.perform(get("/api/bookings/my"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(3));
    }

    @Test
    void getUpcomingBookings_returnsBookings() throws Exception {
        Mockito.when(bookingService.getUpcomingBookings(9L))
                .thenReturn(List.of(bookingResponse(4L, 9L, 7L, BookingStatus.CONFIRMED)));

        mockMvc.perform(get("/api/bookings/upcoming").param("hotelId", "9"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].hotelId").value(9));
    }

    @Test
    void getById_returnsBooking() throws Exception {
        Mockito.when(bookingService.getBookingById(6L))
                .thenReturn(bookingResponse(6L, 12L, 8L, BookingStatus.PENDING));

        mockMvc.perform(get("/api/bookings/6"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(6));
    }

    @Test
    void confirm_returnsConfirmedBooking() throws Exception {
        Mockito.when(bookingService.confirmBooking(6L))
                .thenReturn(bookingResponse(6L, 12L, 8L, BookingStatus.CONFIRMED));

        mockMvc.perform(put("/api/bookings/6/confirm"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"));
    }

    @Test
    void cancel_returnsCancelledBooking() throws Exception {
        Mockito.when(bookingService.cancelBooking(6L))
                .thenReturn(bookingResponse(6L, 12L, 8L, BookingStatus.CANCELLED));

        mockMvc.perform(put("/api/bookings/6/cancel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    void delete_returnsNoContent() throws Exception {
        mockMvc.perform(delete("/api/bookings/8"))
                .andExpect(status().isNoContent());

        Mockito.verify(bookingService).deleteBooking(8L);
    }

    @Test
    void checkAvailability_returnsResponse() throws Exception {
        Mockito.when(bookingService.checkAvailability(
                        4L,
                        LocalDate.of(2026, 6, 1),
                        LocalDate.of(2026, 6, 3)))
                .thenReturn(new AvailabilityCheckResponse(
                        true,
                        new BigDecimal("300.00"),
                        "Available"
                ));

        mockMvc.perform(get("/api/bookings/availability")
                        .param("roomTypeId", "4")
                        .param("startDate", "2026-06-01")
                        .param("endDate", "2026-06-03"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.message").value("Available"));
    }

    private BookingResponse bookingResponse(Long id, Long hotelId, Long roomTypeId, BookingStatus status) {
        BookingResponse response = new BookingResponse();
        response.setId(id);
        response.setHotelId(hotelId);
        response.setRoomTypeId(roomTypeId);
        response.setStatus(status);
        return response;
    }
}