package com.no_mercy_no_doubt.tourism_booking.hotel.auth.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.no_mercy_no_doubt.tourism_booking.auth.controller.AuthController;
import com.no_mercy_no_doubt.tourism_booking.auth.dto.AuthResponse;
import com.no_mercy_no_doubt.tourism_booking.auth.dto.LoginRequest;
import com.no_mercy_no_doubt.tourism_booking.auth.dto.LogoutRequest;
import com.no_mercy_no_doubt.tourism_booking.auth.dto.RefreshTokenRequest;
import com.no_mercy_no_doubt.tourism_booking.auth.dto.RegisterRequest;
import com.no_mercy_no_doubt.tourism_booking.auth.service.AuthService;
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

class AuthControllerTest {

    private MockMvc mockMvc;
    private AuthService authService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        authService = Mockito.mock(AuthService.class);
        objectMapper = new ObjectMapper().findAndRegisterModules();

        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(authService))
                .setValidator(validator)
                .build();
    }

    @Test
    void register_returnsTokens() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("nicola");
        request.setEmail("nicola@test.com");
        request.setPassword("Password1");

        Mockito.when(authService.register(Mockito.any(RegisterRequest.class)))
                .thenReturn(AuthResponse.builder().accessToken("access").refreshToken("refresh").tokenType("Bearer").expiresInSeconds(3600).build());

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("access"));
    }

    @Test
    void login_returnsTokens() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setUsername("nicola");
        request.setPassword("Password1");

        Mockito.when(authService.login(Mockito.any(LoginRequest.class)))
                .thenReturn(AuthResponse.builder().accessToken("access").refreshToken("refresh").tokenType("Bearer").expiresInSeconds(3600).build());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refreshToken").value("refresh"));
    }

    @Test
    void refresh_returnsNewAccessToken() throws Exception {
        RefreshTokenRequest request = new RefreshTokenRequest();
        request.setRefreshToken("old-refresh");

        Mockito.when(authService.refreshToken("old-refresh"))
                .thenReturn(AuthResponse.builder().accessToken("new-access").refreshToken("new-refresh").tokenType("Bearer").expiresInSeconds(3600).build());

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("new-access"));
    }

    @Test
    void logout_returnsMessage() throws Exception {
        LogoutRequest request = new LogoutRequest();
        request.setRefreshToken("refresh-token");

        mockMvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Logged out successfully"));

        Mockito.verify(authService).revokeRefreshToken("refresh-token");
    }
}
