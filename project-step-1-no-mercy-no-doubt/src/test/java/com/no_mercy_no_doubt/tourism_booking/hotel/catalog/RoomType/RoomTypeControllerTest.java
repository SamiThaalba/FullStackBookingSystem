package com.no_mercy_no_doubt.tourism_booking.hotel.catalog.RoomType;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeController;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeRequest;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeResponse;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.math.BigDecimal;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RoomTypeControllerTest {

    private MockMvc mockMvc;
    private RoomTypeService roomTypeService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        roomTypeService = Mockito.mock(RoomTypeService.class);
        objectMapper = new ObjectMapper().findAndRegisterModules();

        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders.standaloneSetup(new RoomTypeController(roomTypeService))
                .setValidator(validator)
                .build();
    }

    @Test
    void post_returnsCreatedRoomType() throws Exception {
        RoomTypeRequest request = new RoomTypeRequest();
        request.setName("Suite");
        request.setCapacity(2);
        request.setInventoryCount(5);
        request.setBasePrice(new BigDecimal("120.00"));
        request.setHotelId(1L);

        Mockito.when(roomTypeService.createRoomType(Mockito.any(RoomTypeRequest.class)))
                .thenReturn(RoomTypeResponse.builder().id(4L).name("Suite").hotelId(1L).build());

        mockMvc.perform(post("/api/room-type")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/room-type/4"))
                .andExpect(jsonPath("$.name").value("Suite"));
    }

    @Test
    void getRoomTypesByHotel_returnsList() throws Exception {
        Mockito.when(roomTypeService.getRoomTypesByHotel(1L))
                .thenReturn(List.of(RoomTypeResponse.builder().id(4L).name("Suite").hotelId(1L).build()));

        mockMvc.perform(get("/api/room-type/hotel/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].hotelId").value(1));
    }

    @Test
    void getRoomTypeById_returnsRoomType() throws Exception {
        Mockito.when(roomTypeService.getRoomTypeById(4L))
                .thenReturn(RoomTypeResponse.builder().id(4L).name("Suite").build());

        mockMvc.perform(get("/api/room-type/4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(4));
    }

    @Test
    void put_returnsUpdatedRoomType() throws Exception {
        RoomTypeRequest request = new RoomTypeRequest();
        request.setName("Updated Suite");
        request.setCapacity(2);
        request.setInventoryCount(5);
        request.setBasePrice(new BigDecimal("150.00"));

        Mockito.when(roomTypeService.updateRoomType(Mockito.eq(4L), Mockito.any(RoomTypeRequest.class)))
                .thenReturn(RoomTypeResponse.builder().id(4L).name("Updated Suite").build());

        mockMvc.perform(put("/api/room-type/4")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Suite"));
    }

    @Test
    void delete_returnsNoContent() throws Exception {
        mockMvc.perform(delete("/api/room-type/4"))
                .andExpect(status().isNoContent());

        Mockito.verify(roomTypeService).deleteRoomType(4L);
    }
}
