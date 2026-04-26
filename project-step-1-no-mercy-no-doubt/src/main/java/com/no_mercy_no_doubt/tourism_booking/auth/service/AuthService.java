package com.no_mercy_no_doubt.tourism_booking.auth.service;

import com.no_mercy_no_doubt.tourism_booking.auth.dto.AuthResponse;
import com.no_mercy_no_doubt.tourism_booking.auth.dto.LoginRequest;
import com.no_mercy_no_doubt.tourism_booking.auth.dto.RegisterRequest;
import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.auth.entity.RefreshToken;
import com.no_mercy_no_doubt.tourism_booking.auth.repository.AppUserRepository;
import com.no_mercy_no_doubt.tourism_booking.auth.repository.RefreshTokenRepository;
import com.no_mercy_no_doubt.tourism_booking.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String DEFAULT_SELF_REGISTER_ROLE = "CUSTOMER";

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final RefreshTokenRepository refreshTokenRepo;
    private final RoleManagementService roleManagementService;

    private final long refreshTokenDays = 7;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException("Username already exists.");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException("Email already exists.");
        }

        AppUser user = AppUser.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .roles(roleManagementService.resolveRoles(Set.of(DEFAULT_SELF_REGISTER_ROLE)))
                .isBlocked(false)
                .build();

        user = userRepository.save(user);
        String jwtToken = jwtService.generateToken(user);
        return toAuthResponse(user, jwtToken);
    }

    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );

        AppUser user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new BusinessException("Username or password is incorrect."));

        String jwtToken = jwtService.generateToken(user);
        return toAuthResponse(user, jwtToken);
    }

    @Transactional
    public AuthResponse refreshToken(String refreshTokenValue) {
        RefreshToken refreshToken = refreshTokenRepo.findByToken(refreshTokenValue)
                .orElseThrow(() -> new BusinessException("Invalid refresh token."));

        if (refreshToken.isRevoked()) {
            throw new BusinessException("Refresh token has been revoked.");
        }

        if (refreshToken.isExpired()) {
            refreshTokenRepo.delete(refreshToken);
            throw new BusinessException("Refresh token has expired.");
        }

        AppUser user = refreshToken.getUser();
        if (user.isBlocked()) {
            throw new BusinessException("User account is blocked.");
        }

        String accessToken = jwtService.generateToken(user);
        String newRefreshToken = rotateRefreshToken(refreshToken);

        return new AuthResponse(
                accessToken,
                newRefreshToken,
                "Bearer",
                jwtService.getAccessTokenExpiresInSeconds()
        );
    }

    @Transactional
    public void revokeRefreshToken(String token) {
        RefreshToken refreshToken = refreshTokenRepo.findByToken(token)
                .orElseThrow(() -> new BusinessException("Refresh token was not found."));

        refreshToken.setRevoked(true);
        refreshTokenRepo.save(refreshToken);
    }

    private String createRefreshToken(AppUser user) {
        String token = UUID.randomUUID().toString();
        Instant expiryDate = Instant.now().plusSeconds(refreshTokenDays * 24 * 60 * 60);

        RefreshToken refreshToken = new RefreshToken(token, user, expiryDate);
        refreshTokenRepo.save(refreshToken);

        return token;
    }

    private String rotateRefreshToken(RefreshToken oldToken) {
        refreshTokenRepo.delete(oldToken);
        return createRefreshToken(oldToken.getUser());
    }

    private AuthResponse toAuthResponse(AppUser user, String token) {
        return new AuthResponse(
                token,
                createRefreshToken(user),
                "Bearer",
                jwtService.getAccessTokenExpiresInSeconds()
        );
    }
}