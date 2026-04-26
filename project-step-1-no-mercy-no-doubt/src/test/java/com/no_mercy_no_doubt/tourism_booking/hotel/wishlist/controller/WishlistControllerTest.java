package com.no_mercy_no_doubt.tourism_booking.hotel.wishlist.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.no_mercy_no_doubt.tourism_booking.wishlist.controller.WishlistController;
import com.no_mercy_no_doubt.tourism_booking.wishlist.dto.CreateWishlistRequest;
import com.no_mercy_no_doubt.tourism_booking.wishlist.dto.WishlistResponse;
import com.no_mercy_no_doubt.tourism_booking.wishlist.enums.WishlistItemType;
import com.no_mercy_no_doubt.tourism_booking.wishlist.service.WishlistService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.time.LocalDateTime;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class WishlistControllerTest {

    private MockMvc mockMvc;
    private WishlistService wishlistService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        wishlistService = Mockito.mock(WishlistService.class);
        objectMapper = new ObjectMapper().findAndRegisterModules();

        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders.standaloneSetup(new WishlistController(wishlistService))
                .setValidator(validator)
                .build();
    }

    @Test
    void add_returnsCreatedWishlistItem() throws Exception {
        CreateWishlistRequest request = new CreateWishlistRequest(WishlistItemType.HOTEL, 1L, "Want to visit soon");

        Mockito.when(wishlistService.add(Mockito.any(CreateWishlistRequest.class)))
                .thenReturn(new WishlistResponse(1L, WishlistItemType.HOTEL, 1L, "Grand Hotel", null, "Bethlehem", "Want to visit soon", LocalDateTime.of(2026, 4, 1, 12, 0)));

        mockMvc.perform(post("/api/wishlist")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.targetName").value("Grand Hotel"));
    }

    @Test
    void myWishlist_returnsList() throws Exception {
        Mockito.when(wishlistService.myWishlist())
                .thenReturn(List.of(new WishlistResponse(1L, WishlistItemType.HOTEL, 1L, "Grand Hotel", null, "Bethlehem", null, LocalDateTime.of(2026, 4, 1, 12, 0))));

        mockMvc.perform(get("/api/wishlist"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].itemType").value("HOTEL"));
    }

    @Test
    void remove_returnsNoContent() throws Exception {
        mockMvc.perform(delete("/api/wishlist")
                        .param("itemType", "HOTEL")
                        .param("targetId", "1"))
                .andExpect(status().isNoContent());

        Mockito.verify(wishlistService).remove(WishlistItemType.HOTEL, 1L);
    }
}
