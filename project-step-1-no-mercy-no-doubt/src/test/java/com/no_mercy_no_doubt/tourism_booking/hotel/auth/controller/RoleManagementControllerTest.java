package com.no_mercy_no_doubt.tourism_booking.hotel.auth.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.no_mercy_no_doubt.tourism_booking.auth.controller.RoleManagementController;
import com.no_mercy_no_doubt.tourism_booking.auth.dto.*;
import com.no_mercy_no_doubt.tourism_booking.auth.service.RoleManagementService;
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

class RoleManagementControllerTest {

    private MockMvc mockMvc;
    private RoleManagementService roleManagementService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        roleManagementService = Mockito.mock(RoleManagementService.class);
        objectMapper = new ObjectMapper().findAndRegisterModules();

        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders.standaloneSetup(new RoleManagementController(roleManagementService))
                .setValidator(validator)
                .build();
    }

    @Test
    void getRoles_returnsRoles() throws Exception {
        Mockito.when(roleManagementService.getRoles())
                .thenReturn(List.of(RoleResponse.builder().id(1L).name("ADMIN").permissions(Set.of("hotel:create")).build()));

        mockMvc.perform(get("/api/admin/roles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("ADMIN"));
    }

    @Test
    void createRole_returnsCreatedRole() throws Exception {
        CreateRoleRequest request = new CreateRoleRequest();
        request.setName("MANAGER");
        request.setDescription("manager role");

        Mockito.when(roleManagementService.createRole(Mockito.any(CreateRoleRequest.class)))
                .thenReturn(RoleResponse.builder().id(2L).name("MANAGER").description("manager role").build());

        mockMvc.perform(post("/api/admin/roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("MANAGER"));
    }

    @Test
    void replaceRolePermissions_returnsUpdatedRole() throws Exception {
        UpdateRolePermissionsRequest request = new UpdateRolePermissionsRequest();
        request.setPermissionNames(Set.of("booking:view"));

        Mockito.when(roleManagementService.replaceRolePermissions(Mockito.eq(2L), Mockito.any(UpdateRolePermissionsRequest.class)))
                .thenReturn(RoleResponse.builder().id(2L).name("MANAGER").permissions(Set.of("booking:view")).build());

        mockMvc.perform(put("/api/admin/roles/2/permissions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.permissions[0]").value("booking:view"));
    }

    @Test
    void getPermissions_returnsPermissions() throws Exception {
        Mockito.when(roleManagementService.getPermissions())
                .thenReturn(List.of(PermissionResponse.builder().id(1L).name("booking:view").description("view bookings").build()));

        mockMvc.perform(get("/api/admin/permissions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("booking:view"));
    }

    @Test
    void createPermission_returnsCreatedPermission() throws Exception {
        CreatePermissionRequest request = new CreatePermissionRequest();
        request.setName("payment:create");
        request.setDescription("create payments");

        Mockito.when(roleManagementService.createPermission(Mockito.any(CreatePermissionRequest.class)))
                .thenReturn(PermissionResponse.builder().id(3L).name("payment:create").description("create payments").build());

        mockMvc.perform(post("/api/admin/permissions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("payment:create"));
    }

    @Test
    void assignRoleToUser_returnsUpdatedUser() throws Exception {
        Mockito.when(roleManagementService.assignRoleToUser(5L, 2L))
                .thenReturn(UserResponse.builder().id(5L).username("manager").roles(Set.of("MANAGER")).build());

        mockMvc.perform(post("/api/admin/users/5/roles/2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles[0]").value("MANAGER"));
    }

    @Test
    void removeRoleFromUser_returnsUpdatedUser() throws Exception {
        Mockito.when(roleManagementService.removeRoleFromUser(5L, 2L))
                .thenReturn(UserResponse.builder().id(5L).username("manager").roles(Set.of()).build());

        mockMvc.perform(delete("/api/admin/users/5/roles/2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(5));
    }
}
