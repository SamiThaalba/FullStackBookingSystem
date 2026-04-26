package com.no_mercy_no_doubt.tourism_booking.hotel.catalog.Hotel;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.*;
import com.no_mercy_no_doubt.tourism_booking.common.dto.PageResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class HotelControllerTest {

    private MockMvc mockMvc;
    private HotelService hotelService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        hotelService = Mockito.mock(HotelService.class);
        objectMapper = new ObjectMapper().findAndRegisterModules();

        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders.standaloneSetup(new HotelController(hotelService))
                .setValidator(validator)
                .build();
    }

    @Test
    void createHotel_returnsCreatedHotel() throws Exception {
        HotelRequest request = new HotelRequest();
        request.setName("Grand Hotel");
        request.setAddress("Main street");
        request.setManagerId(2L);

        Mockito.when(hotelService.createHotel(any(HotelRequest.class)))
                .thenReturn(HotelResponse.builder().id(1L).name("Grand Hotel").address("Main street").build());

        mockMvc.perform(post("/api/hotels")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("Grand Hotel"));
    }

    @Test
    void getHotel_returnsHotel() throws Exception {
        Mockito.when(hotelService.getHotelById(1L))
                .thenReturn(HotelResponse.builder().id(1L).name("Grand Hotel").city("Bethlehem").build());

        mockMvc.perform(get("/api/hotels/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.city").value("Bethlehem"));
    }

    @Test
    void updateHotel_returnsUpdatedHotel() throws Exception {
        HotelRequest request = new HotelRequest();
        request.setName("Updated Hotel");
        request.setAddress("Updated address");
        request.setManagerId(3L);

        Mockito.when(hotelService.updateHotel(eq(1L), any(HotelRequest.class)))
                .thenReturn(HotelResponse.builder().id(1L).name("Updated Hotel").address("Updated address").build());

        mockMvc.perform(put("/api/hotels/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Hotel"));
    }

    @Test
    void patchHotel_returnsPatchedHotel() throws Exception {
        HotelPatchRequest request = new HotelPatchRequest("Patched Hotel", null, null, "Jerusalem", null, null, null, null);

        Mockito.when(hotelService.patchHotel(eq(1L), any(HotelPatchRequest.class)))
                .thenReturn(HotelResponse.builder().id(1L).name("Patched Hotel").city("Jerusalem").build());

        mockMvc.perform(patch("/api/hotels/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Patched Hotel"))
                .andExpect(jsonPath("$.city").value("Jerusalem"));
    }

    @Test
    void deleteHotel_returnsNoContent() throws Exception {
        mockMvc.perform(delete("/api/hotels/1"))
                .andExpect(status().isNoContent());

        Mockito.verify(hotelService).deleteHotel(1L);
    }

    @Test
    void getHotels_returnsPage() throws Exception {
        Mockito.when(hotelService.listHotelsWithFilters("Bethlehem", "Palestine", "Grand", 0, 10))
                .thenReturn(PageResponse.<HotelResponse>builder()
                        .content(List.of(HotelResponse.builder().id(1L).name("Grand Hotel").build()))
                        .page(0).size(10).totalElements(1).totalPages(1).first(true).last(true)
                        .build());

        mockMvc.perform(get("/api/hotels")
                        .param("city", "Bethlehem")
                        .param("country", "Palestine")
                        .param("name", "Grand")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].name").value("Grand Hotel"))
                .andExpect(jsonPath("$.totalElements").value(1));
    }
}
