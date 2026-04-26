package com.no_mercy_no_doubt.tourism_booking.hotel.auth.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.no_mercy_no_doubt.tourism_booking.auth.controller.AppUserController;
import com.no_mercy_no_doubt.tourism_booking.auth.dto.UserCreateRequest;
import com.no_mercy_no_doubt.tourism_booking.auth.dto.UserResponse;
import com.no_mercy_no_doubt.tourism_booking.auth.dto.UserUpdateRequest;
import com.no_mercy_no_doubt.tourism_booking.auth.service.AppUserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.util.List;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AppUserControllerTest {

    private MockMvc mockMvc;
    private AppUserService appUserService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        appUserService = Mockito.mock(AppUserService.class);
        objectMapper = new ObjectMapper().findAndRegisterModules();

        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders.standaloneSetup(new AppUserController(appUserService))
                .setValidator(validator)
                .build();
    }

    @Test
    void getAll_returnsUsers() throws Exception {
        Mockito.when(appUserService.getAll())
                .thenReturn(List.of(UserResponse.builder().id(1L).username("admin").email("admin@test.com").roles(Set.of("ADMIN")).build()));

        mockMvc.perform(get("/api/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].username").value("admin"));
    }

    @Test
    void getById_returnsUser() throws Exception {
        Mockito.when(appUserService.getById(1L))
                .thenReturn(UserResponse.builder().id(1L).username("admin").email("admin@test.com").build());

        mockMvc.perform(get("/api/users/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void create_returnsCreatedUser() throws Exception {
        UserCreateRequest request = UserCreateRequest.builder()
                .username("guest")
                .email("guest@test.com")
                .password("Password1")
                .roleNames(Set.of("GUEST"))
                .build();

        Mockito.when(appUserService.create(Mockito.any(UserCreateRequest.class)))
                .thenReturn(UserResponse.builder().id(2L).username("guest").email("guest@test.com").build());

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("guest"));
    }

    @Test
    void update_returnsUpdatedUser() throws Exception {
        UserUpdateRequest request = new UserUpdateRequest();
        request.setEmail("updated@test.com");
        request.setRoleNames(Set.of("MANAGER"));
        request.setBlocked(false);

        Mockito.when(appUserService.update(Mockito.eq(3L), Mockito.any(UserUpdateRequest.class)))
                .thenReturn(UserResponse.builder().id(3L).username("manager").email("updated@test.com").build());

        mockMvc.perform(put("/api/users/3")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("updated@test.com"));
    }

    @Test
    void delete_returnsNoContent() throws Exception {
        mockMvc.perform(delete("/api/users/5"))
                .andExpect(status().isNoContent());

        Mockito.verify(appUserService).delete(5L);
    }
}
