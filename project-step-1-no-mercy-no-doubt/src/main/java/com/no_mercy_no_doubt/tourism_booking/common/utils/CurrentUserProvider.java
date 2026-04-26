package com.no_mercy_no_doubt.tourism_booking.common.utils;

import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.auth.repository.AppUserRepository;
import com.no_mercy_no_doubt.tourism_booking.auth.utils.SecurityUtils;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CurrentUserProvider {

    private final AppUserRepository appUserRepository;

    public AppUser getCurrentUser() {
        String username = SecurityUtils.currentUsername();

        if (username == null || username.isBlank()) {
            throw new IllegalStateException("No authenticated user was found.");
        }

        AppUser user = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("Current user was not found."));

        if (user.isBlocked()) {
            throw new IllegalStateException("Your account is blocked.");
        }

        return user;
    }
}