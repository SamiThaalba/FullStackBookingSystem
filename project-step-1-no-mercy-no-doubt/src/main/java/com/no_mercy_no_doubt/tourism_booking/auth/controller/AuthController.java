package com.no_mercy_no_doubt.tourism_booking.auth.controller;

import com.no_mercy_no_doubt.tourism_booking.auth.dto.AuthResponse;
import com.no_mercy_no_doubt.tourism_booking.auth.dto.LoginRequest;
import com.no_mercy_no_doubt.tourism_booking.auth.dto.LogoutRequest;
import com.no_mercy_no_doubt.tourism_booking.auth.dto.RefreshTokenRequest;
import com.no_mercy_no_doubt.tourism_booking.auth.dto.RegisterRequest;
import com.no_mercy_no_doubt.tourism_booking.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(authService.refreshToken(request.getRefreshToken()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(@Valid @RequestBody LogoutRequest request) {
        authService.revokeRefreshToken(request.getRefreshToken());
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }
}