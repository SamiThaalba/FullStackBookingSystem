package com.no_mercy_no_doubt.tourism_booking.auth.controller;

import com.no_mercy_no_doubt.tourism_booking.auth.dto.*;
import com.no_mercy_no_doubt.tourism_booking.auth.service.RoleManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('role:manage')")
public class RoleManagementController {

    private final RoleManagementService roleManagementService;

    @GetMapping("/roles")
    public ResponseEntity<List<RoleResponse>> getRoles() {
        return ResponseEntity.ok(roleManagementService.getRoles());
    }

    @PostMapping("/roles")
    public ResponseEntity<RoleResponse> createRole(@Valid @RequestBody CreateRoleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(roleManagementService.createRole(request));
    }

    @PutMapping("/roles/{roleId}/permissions")
    public ResponseEntity<RoleResponse> replaceRolePermissions(
            @PathVariable Long roleId,
            @Valid @RequestBody UpdateRolePermissionsRequest request
    ) {
        return ResponseEntity.ok(roleManagementService.replaceRolePermissions(roleId, request));
    }

    @GetMapping("/permissions")
    public ResponseEntity<List<PermissionResponse>> getPermissions() {
        return ResponseEntity.ok(roleManagementService.getPermissions());
    }

    @PostMapping("/permissions")
    public ResponseEntity<PermissionResponse> createPermission(@Valid @RequestBody CreatePermissionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(roleManagementService.createPermission(request));
    }

    @PostMapping("/users/{userId}/roles/{roleId}")
    public ResponseEntity<UserResponse> assignRoleToUser(@PathVariable Long userId, @PathVariable Long roleId) {
        return ResponseEntity.ok(roleManagementService.assignRoleToUser(userId, roleId));
    }

    @DeleteMapping("/users/{userId}/roles/{roleId}")
    public ResponseEntity<UserResponse> removeRoleFromUser(@PathVariable Long userId, @PathVariable Long roleId) {
        return ResponseEntity.ok(roleManagementService.removeRoleFromUser(userId, roleId));
    }
}