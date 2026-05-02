package com.no_mercy_no_doubt.tourism_booking.auth.service;

import com.no_mercy_no_doubt.tourism_booking.auth.dto.UserCreateRequest;
import com.no_mercy_no_doubt.tourism_booking.auth.dto.UserResponse;
import com.no_mercy_no_doubt.tourism_booking.auth.dto.UserUpdateRequest;
import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.auth.repository.AppUserRepository;
import com.no_mercy_no_doubt.tourism_booking.common.exception.BusinessException;
import com.no_mercy_no_doubt.tourism_booking.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AppUserService {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final RoleManagementService roleManagementService;

    public List<UserResponse> getAll() {
        return userRepository.findAll().stream().map(roleManagementService::toUserResponse).toList();
    }

    public UserResponse getById(Long id) {
        AppUser user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));
        return roleManagementService.toUserResponse(user);
    }

    @Transactional
    public UserResponse create(UserCreateRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new BusinessException("Username already exists.");
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException("Email already exists.");
        }

        AppUser user = AppUser.builder()
                .username(request.username())
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .roles(roleManagementService.resolveRoles(request.roleNames()))
                .isBlocked(false)
                .build();

        return roleManagementService.toUserResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse update(Long id, UserUpdateRequest request) {
        AppUser user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));

        if (userRepository.existsByEmailAndIdNot(request.getEmail(), id)) {
            throw new BusinessException("Email already exists.");
        }

        user.setEmail(request.getEmail());
        user.setRoles(roleManagementService.resolveRoles(request.getRoleNames()));
        user.setBlocked(request.getBlocked());
        return roleManagementService.toUserResponse(userRepository.save(user));
    }

    @Transactional
    public void delete(Long id) {
        if (!userRepository.existsById(id)) {
            throw new ResourceNotFoundException("User", id);
        }
        userRepository.deleteById(id);
    }

    @Transactional
    public void updatePreferredUiLanguage(String username, String language) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User was not found."));
        user.setPreferredUiLanguage(normalizeUiLanguage(language));
    }

    private static String normalizeUiLanguage(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessException("Language is required.");
        }
        String lc = raw.trim().toLowerCase(Locale.ROOT);
        if (lc.startsWith("ar")) {
            return "ar";
        }
        if (lc.startsWith("en")) {
            return "en";
        }
        throw new BusinessException("Unsupported language. Use \"en\" or \"ar\".");
    }
}