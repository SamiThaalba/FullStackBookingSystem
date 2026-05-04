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

import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoleManagementService {

    private static final Set<String> MANAGER_SCOPED_PERMISSIONS = Set.of(
            "hotel:create",
            "hotel:update",
            "hotel:delete",
            "room:create",
            "room:update",
            "room:delete",
            "booking:update",
            "booking:cancel",
            "analytics:view"
    );

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

        Role role = Role.builder()
                .name(roleName)
                .description(request.getDescription().trim())
                .permissions(new LinkedHashSet<>())
                .build();
        role.setPermissions(resolvePermissionsByIds(request.getPermissionIds()));
        role = roleRepository.save(role);
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

        Set<Long> ids = request.getPermissionIds() != null
                ? request.getPermissionIds()
                : Set.of();
        role.setPermissions(resolvePermissionsByIds(ids));
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

    public boolean userHasPermission(AppUser user, String permissionName) {
        if (permissionName == null) {
            return false;
        }
        for (Role role : user.getRoles()) {
            for (Permission permission : role.getPermissions()) {
                if (permission.getName().equals(permissionName)) {
                    return true;
                }
            }
        }
        return false;
    }

    public boolean userHasManagerPermissions(AppUser user) {
        Set<String> currentPermissions = user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(Permission::getName)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        return currentPermissions.stream().anyMatch(MANAGER_SCOPED_PERMISSIONS::contains);
    }

    public boolean canBypassHotelScope(AppUser user) {
        return userHasPermission(user, "hotel:view_all") && !userHasManagerPermissions(user);
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
                .avatarUrl(user.getAvatarUrl())
                .roles(roleNames)
                .permissions(permissionNames)
                .blocked(user.isBlocked())
                .build();
    }

    private Set<Permission> resolvePermissionsByIds(Collection<Long> permissionIds) {
        if (permissionIds == null || permissionIds.isEmpty()) {
            return new LinkedHashSet<>();
        }
        Set<Long> uniqueIds = permissionIds.stream().collect(Collectors.toCollection(LinkedHashSet::new));
        List<Permission> found = permissionRepository.findAllById(uniqueIds);
        if (found.size() != uniqueIds.size()) {
            Set<Long> foundIds = found.stream().map(Permission::getId).collect(Collectors.toSet());
            String missing = uniqueIds.stream()
                    .filter(id -> !foundIds.contains(id))
                    .map(String::valueOf)
                    .collect(Collectors.joining(", "));
            throw new BusinessException("Unknown permission ids: " + missing + ".");
        }
        return new LinkedHashSet<>(found);
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