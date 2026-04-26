package com.no_mercy_no_doubt.tourism_booking.hotel.IntegrationTest;

import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.auth.entity.AuthDataInitializer;
import com.no_mercy_no_doubt.tourism_booking.auth.repository.AppUserRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.Booking.Booking;
import com.no_mercy_no_doubt.tourism_booking.catalog.Booking.BookingRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.Booking.BookingStatus;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.Hotel;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.HotelRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomType;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

@SpringBootTest
@ActiveProfiles("test")
class BookingControllerIntegrationTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private HotelRepository hotelRepository;

    @Autowired
    private RoomTypeRepository roomTypeRepository;

    @Autowired
    private AppUserRepository appUserRepository;

    @MockitoBean
    private AuthDataInitializer authDataInitializer;

    private MockMvc mockMvc;

    private AppUser guest;
    private Hotel hotel;
    private RoomType roomType;

    @BeforeEach
    void setUp() {
        mockMvc = webAppContextSetup(context)
                .apply(springSecurity())
                .build();

        bookingRepository.deleteAll();
        roomTypeRepository.deleteAll();
        hotelRepository.deleteAll();
        appUserRepository.deleteAll();

        guest = AppUser.builder()
                .username("guest1")
                .email("guest1@test.local")
                .password("encoded-password")
                .isBlocked(false)
                .build();
        guest = appUserRepository.save(guest);

        hotel = Hotel.builder()
                .name("Test Hotel")
                .address("Main Street")
                .city("Bethlehem")
                .country("Palestine")
                .managerId(99L)
                .build();
        hotel = hotelRepository.save(hotel);

        roomType = RoomType.builder()
                .hotel(hotel)
                .name("Deluxe Room")
                .capacity(2)
                .inventoryCount(5)
                .basePrice(new BigDecimal("150.00"))
                .amenities(List.of("WiFi", "AC"))
                .build();
        roomType = roomTypeRepository.save(roomType);
    }

    @Test
    @WithMockUser(username = "guest1", authorities = "booking:create")
    void createBooking_returnsCreated_andSavesToDatabase() throws Exception {
        String requestBody = """
                {
                  "hotelId": %d,
                  "roomTypeId": %d,
                  "startDate": "2099-06-10",
                  "endDate": "2099-06-12"
                }
                """.formatted(hotel.getId(), roomType.getId());

        mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.hotelId").value(hotel.getId()))
                .andExpect(jsonPath("$.roomTypeId").value(roomType.getId()))
                .andExpect(jsonPath("$.guestId").value(guest.getId()))
                .andExpect(jsonPath("$.status").value("PENDING"));

        assertEquals(1, bookingRepository.count());

        Booking savedBooking = bookingRepository.findAll().get(0);
        assertEquals(hotel.getId(), savedBooking.getHotelId());
        assertEquals(roomType.getId(), savedBooking.getRoomTypeId());
        assertEquals(guest.getId(), savedBooking.getGuestId());
        assertEquals(BookingStatus.PENDING, savedBooking.getStatus());
        assertNotNull(savedBooking.getTotalPrice());
    }
}