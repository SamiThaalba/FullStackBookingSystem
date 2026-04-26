package com.no_mercy_no_doubt.tourism_booking.auth.service;

import com.no_mercy_no_doubt.tourism_booking.auth.dto.*;
import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.auth.entity.Permission;
import com.no_mercy_no_doubt.tourism_booking.auth.entity.Role;
import com.no_mercy_no_doubt.tourism_booking.auth.repository.AppUserRepository;
import com.no_mercy_no_doubt.tourism_booking.auth.repository.PermissionRepository;
import com.no_mercy_no_doubt.tourism_booking.auth.repository.RoleRepository;
import com.no_mercy_no_doubt.tourism_booking.common.exception.BusinessException;
import com.no_mercy_no_doubt.tourism_booking.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class RoleManagementService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final AppUserRepository userRepository;

    public List<RoleResponse> getRoles() {
        return roleRepository.findAll().stream()
                .sorted(Comparator.comparing(Role::getName))
                .map(this::toRoleResponse)
                .toList();
    }

    public List<PermissionResponse> getPermissions() {
        return permissionRepository.findAll().stream()
                .sorted(Comparator.comparing(Permission::getName))
                .map(this::toPermissionResponse)
                .toList();
    }

    @Transactional
    public RoleResponse createRole(CreateRoleRequest request) {
        String roleName = normalize(request.getName());
        if (roleRepository.existsByName(roleName)) {
            throw new BusinessException("Role already exists.");
        }

        Role role = roleRepository.save(Role.builder()
                .name(roleName)
                .description(request.getDescription().trim())
                .build());

        return toRoleResponse(role);
    }

    @Transactional
    public PermissionResponse createPermission(CreatePermissionRequest request) {
        String permissionName = normalizePermission(request.getName());
        if (permissionRepository.existsByName(permissionName)) {
            throw new BusinessException("Permission already exists.");
        }

        Permission permission = permissionRepository.save(Permission.builder()
                .name(permissionName)
                .description(request.getDescription().trim())
                .build());

        return toPermissionResponse(permission);
    }

    @Transactional
    public RoleResponse replaceRolePermissions(Long roleId, UpdateRolePermissionsRequest request) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", roleId));

        role.setPermissions(resolvePermissions(request.getPermissionNames()));
        return toRoleResponse(roleRepository.save(role));
    }

    @Transactional
    public UserResponse assignRoleToUser(Long userId, Long roleId) {
        AppUser user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", roleId));

        user.getRoles().add(role);
        return toUserResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse removeRoleFromUser(Long userId, Long roleId) {
        AppUser user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", roleId));

        user.getRoles().removeIf(existingRole -> existingRole.getId().equals(role.getId()));
        if (user.getRoles().isEmpty()) {
            throw new BusinessException("User must keep at least one role.");
        }
        return toUserResponse(userRepository.save(user));
    }

    public Set<Role> resolveRoles(Set<String> roleNames) {
        Set<String> normalizedNames = roleNames.stream()
                .map(this::normalize)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

        List<Role> roles = roleRepository.findAll().stream()
                .filter(role -> normalizedNames.contains(role.getName()))
                .toList();

        if (roles.size() != normalizedNames.size()) {
            Set<String> found = roles.stream().map(Role::getName).collect(java.util.stream.Collectors.toSet());
            Set<String> missing = normalizedNames.stream()
                    .filter(name -> !found.contains(name))
                    .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
            throw new BusinessException("Unknown roles: " + String.join(", ", missing) + ".");
        }

        return new LinkedHashSet<>(roles);
    }

    public boolean userHasRole(AppUser user, String roleName) {
        String normalizedRole = normalize(roleName);
        return user.getRoles().stream().anyMatch(role -> role.getName().equals(normalizedRole));
    }

    public UserResponse toUserResponse(AppUser user) {
        Set<String> roleNames = user.getRoles().stream()
                .map(Role::getName)
                .collect(java.util.stream.Collectors.toCollection(java.util.TreeSet::new));

        Set<String> permissionNames = user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(Permission::getName)
                .collect(java.util.stream.Collectors.toCollection(java.util.TreeSet::new));

        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .roles(roleNames)
                .permissions(permissionNames)
                .blocked(user.isBlocked())
                .build();
    }

    private Set<Permission> resolvePermissions(Set<String> permissionNames) {
        Set<String> normalizedNames = permissionNames.stream()
                .map(this::normalizePermission)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

        List<Permission> permissions = permissionRepository.findByNameIn(normalizedNames);

        if (permissions.size() != normalizedNames.size()) {
            Set<String> found = permissions.stream().map(Permission::getName).collect(java.util.stream.Collectors.toSet());
            Set<String> missing = normalizedNames.stream()
                    .filter(name -> !found.contains(name))
                    .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
            throw new BusinessException("Unknown permissions: " + String.join(", ", missing) + ".");
        }

        return new LinkedHashSet<>(permissions);
    }

    private RoleResponse toRoleResponse(Role role) {
        Set<String> permissions = role.getPermissions().stream()
                .map(Permission::getName)
                .collect(java.util.stream.Collectors.toCollection(java.util.TreeSet::new));

        return RoleResponse.builder()
                .id(role.getId())
                .name(role.getName())
                .description(role.getDescription())
                .permissions(permissions)
                .build();
    }

    private PermissionResponse toPermissionResponse(Permission permission) {
        return PermissionResponse.builder()
                .id(permission.getId())
                .name(permission.getName())
                .description(permission.getDescription())
                .build();
    }

    private String normalize(String value) {
        return value.trim().toUpperCase().replace(' ', '_');
    }

    private String normalizePermission(String value) {
        return value.trim().toLowerCase();
    }
}