package com.no_mercy_no_doubt.tourism_booking.auth.entity;

import com.no_mercy_no_doubt.tourism_booking.auth.repository.AppUserRepository;
import com.no_mercy_no_doubt.tourism_booking.auth.repository.PermissionRepository;
import com.no_mercy_no_doubt.tourism_booking.auth.repository.RoleRepository;
import com.no_mercy_no_doubt.tourism_booking.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class AuthDataInitializer implements CommandLineRunner {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.bootstrap-enabled:false}")
    private boolean adminBootstrapEnabled;

    @Value("${app.admin.username:admin}")
    private String adminUsername;

    @Value("${app.admin.email:admin@example.com}")
    private String adminEmail;

    @Value("${app.admin.password:Admin@123456}")
    private String adminPassword;

    @Override
    public void run(String... args) {
        seedPermissions();
        seedRoles();
        seedAdminUser();
    }

    private void seedPermissions() {
        Map<String, String> permissions = new LinkedHashMap<>();
        permissions.put("hotel:create", "Create hotels");
        permissions.put("hotel:view", "View hotels");
        permissions.put("hotel:update", "Update hotels");
        permissions.put("hotel:delete", "Delete hotels");

        permissions.put("room:create", "Create room types");
        permissions.put("room:view", "View room types");
        permissions.put("room:update", "Update room types");
        permissions.put("room:delete", "Delete room types");

        permissions.put("availability:view", "Check room availability");
        permissions.put("recommendation:view", "View recommendations");
        permissions.put("analytics:view", "View analytics");

        permissions.put("booking:create", "Create bookings");
        permissions.put("booking:view", "View bookings");
        permissions.put("booking:update", "Update bookings");
        permissions.put("booking:cancel", "Cancel bookings");

        permissions.put("payment:create", "Create payments");
        permissions.put("payment:view", "View payments");
        permissions.put("payment:update", "Process payments (mock)");

        permissions.put("wishlist:manage", "Manage wishlist and alerts");
        permissions.put("notification:view", "View notifications");

        permissions.put("user:manage", "Manage users");
        permissions.put("role:manage", "Manage roles and permissions");

        permissions.forEach((name, description) ->
                permissionRepository.findByName(name).orElseGet(() ->
                        permissionRepository.save(Permission.builder()
                                .name(name)
                                .description(description)
                                .build())
                )
        );
    }

    private void seedRoles() {
        createOrUpdateRole("ADMIN", "System administrator", Set.of(
                "hotel:create", "hotel:view", "hotel:update", "hotel:delete",
                "room:create", "room:view", "room:update", "room:delete",
                "availability:view", "recommendation:view", "analytics:view",
                "booking:create", "booking:view", "booking:update", "booking:cancel",
                "payment:create", "payment:view", "payment:update",
                "wishlist:manage", "notification:view",
                "user:manage", "role:manage"
        ));

        // FIX: Added hotel:create, hotel:delete, room:delete, booking:cancel
        // so managers can fully manage their own hotels and rooms.
        createOrUpdateRole("MANAGER", "Hotel manager", Set.of(
                "hotel:create", "hotel:view", "hotel:update", "hotel:delete",
                "room:create", "room:view", "room:update", "room:delete",
                "availability:view", "recommendation:view", "analytics:view",
                "booking:view", "booking:update", "booking:cancel",
                "payment:view", "payment:update", "notification:view"
        ));

        createOrUpdateRole("CUSTOMER", "Customer role", Set.of(
                "hotel:view", "room:view", "availability:view", "recommendation:view",
                "booking:create", "booking:view", "booking:update", "booking:cancel",
                "payment:create", "payment:view", "payment:update",
                "wishlist:manage", "notification:view"
        ));
    }

    private void createOrUpdateRole(String name, String description, Set<String> permissionNames) {
        Set<Permission> permissions = permissionRepository.findAll().stream()
                .filter(permission -> permissionNames.contains(permission.getName()))
                .collect(Collectors.toSet());

        Role role = roleRepository.findByName(name)
                .orElse(Role.builder().name(name).build());

        role.setDescription(description);
        role.setPermissions(permissions);

        roleRepository.save(role);
    }

    private void seedAdminUser() {
        if (!adminBootstrapEnabled) {
            return;
        }

        Role adminRole = roleRepository.findByName("ADMIN")
                .orElseThrow(() -> new BusinessException("ADMIN role was not found."));

        AppUser existingAdmin = userRepository.findByUsername(adminUsername).orElse(null);

        if (existingAdmin != null) {
            if (existingAdmin.getRoles() == null || existingAdmin.getRoles().isEmpty()) {
                existingAdmin.setRoles(Set.of(adminRole));
                userRepository.save(existingAdmin);
            }
            return;
        }

        AppUser admin = AppUser.builder()
                .username(adminUsername)
                .email(adminEmail)
                .password(passwordEncoder.encode(adminPassword))
                .roles(Set.of(adminRole))
                .isBlocked(false)
                .build();

        userRepository.save(admin);
    }
}