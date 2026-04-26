package com.no_mercy_no_doubt.tourism_booking.hotel.wishlist.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.no_mercy_no_doubt.tourism_booking.wishlist.controller.AlertController;
import com.no_mercy_no_doubt.tourism_booking.wishlist.dto.AlertResponse;
import com.no_mercy_no_doubt.tourism_booking.wishlist.dto.CreateAlertRequest;
import com.no_mercy_no_doubt.tourism_booking.wishlist.enums.AlertType;
import com.no_mercy_no_doubt.tourism_booking.wishlist.service.AlertService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AlertControllerTest {

    private MockMvc mockMvc;
    private AlertService alertService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        alertService = Mockito.mock(AlertService.class);
        objectMapper = new ObjectMapper().findAndRegisterModules();

        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders.standaloneSetup(new AlertController(alertService))
                .setValidator(validator)
                .build();
    }

    @Test
    void create_returnsCreatedAlert() throws Exception {
        CreateAlertRequest request = new CreateAlertRequest(4L, AlertType.PRICE_BELOW, null, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 3), 2);

        Mockito.when(alertService.create(Mockito.any(CreateAlertRequest.class)))
                .thenReturn(new AlertResponse(1L, 4L, "Suite", "Grand Hotel", AlertType.PRICE_BELOW, null,
                        LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 3), 2, true, false,
                        LocalDateTime.of(2026, 4, 1, 11, 0), null));

        mockMvc.perform(post("/api/alerts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roomTypeId").value(4));
    }

    @Test
    void myAlerts_returnsList() throws Exception {
        Mockito.when(alertService.myAlerts())
                .thenReturn(List.of(new AlertResponse(1L, 4L, "Suite", "Grand Hotel", AlertType.AVAILABLE_NOW, null,
                        LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 3), 2, true, false,
                        LocalDateTime.of(2026, 4, 1, 11, 0), null)));

        mockMvc.perform(get("/api/alerts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].alertType").value("AVAILABLE_NOW"));
    }

    @Test
    void activate_returnsAlert() throws Exception {
        Mockito.when(alertService.activate(1L))
                .thenReturn(new AlertResponse(1L, 4L, "Suite", "Grand Hotel", AlertType.PRICE_BELOW, null,
                        LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 3), 2, true, false,
                        LocalDateTime.of(2026, 4, 1, 11, 0), null));

        mockMvc.perform(patch("/api/alerts/1/activate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void deactivate_returnsAlert() throws Exception {
        Mockito.when(alertService.deactivate(1L))
                .thenReturn(new AlertResponse(1L, 4L, "Suite", "Grand Hotel", AlertType.PRICE_BELOW, null,
                        LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 3), 2, false, false,
                        LocalDateTime.of(2026, 4, 1, 11, 0), null));

        mockMvc.perform(patch("/api/alerts/1/deactivate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }
}
