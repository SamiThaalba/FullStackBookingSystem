package com.no_mercy_no_doubt.tourism_booking.hotel.catalog.Payment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.no_mercy_no_doubt.tourism_booking.catalog.Payment.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PaymentControllerTest {

    private MockMvc mockMvc;
    private PaymentService paymentService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        paymentService = Mockito.mock(PaymentService.class);
        objectMapper = new ObjectMapper().findAndRegisterModules();

        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders.standaloneSetup(new PaymentController(paymentService))
                .setValidator(validator)
                .build();
    }

    @Test
    void createPayment_returnsCreatedPayment() throws Exception {
        PaymentRequest request = new PaymentRequest();
        request.setBookingId(5L);

        Mockito.when(paymentService.createPayment(Mockito.any(PaymentRequest.class)))
                .thenReturn(PaymentResponse.builder().id(9L).bookingId(5L).amount(150.0).status(PaymentStatus.PENDING).build());

        mockMvc.perform(post("/api/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(9))
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    void processPayment_returnsUpdatedStatus() throws Exception {
        Mockito.when(paymentService.processPayment(9L, true))
                .thenReturn(PaymentResponse.builder().id(9L).bookingId(5L).status(PaymentStatus.SUCCESS).message("Payment processed").build());

        mockMvc.perform(post("/api/payments/9/process").param("success", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"));
    }
}
