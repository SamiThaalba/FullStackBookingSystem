package com.no_mercy_no_doubt.tourism_booking.auth.controller;

import com.no_mercy_no_doubt.tourism_booking.auth.dto.UiLanguageRequest;
import com.no_mercy_no_doubt.tourism_booking.auth.service.AppUserService;
import com.no_mercy_no_doubt.tourism_booking.auth.utils.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
@Validated
public class SelfProfileController {

    private final AppUserService userService;

    @PatchMapping("/ui-language")
    public ResponseEntity<Void> patchUiLanguage(@Valid @RequestBody UiLanguageRequest body) {
        String username = SecurityUtils.currentUsername();
        if (username == null || username.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        userService.updatePreferredUiLanguage(username, body.language());
        return ResponseEntity.noContent().build();
    }
}
