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
import java.util.Optional;
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

    /**
     * Find or provision a CUSTOMER linked to Google's verified profile and return API tokens for the SPA.
     */
    @Transactional
    public AuthResponse loginOrRegisterFromGoogleOAuth(String emailFromGoogle) {
        if (emailFromGoogle == null || emailFromGoogle.isBlank()) {
            throw new BusinessException("Google did not share an email for this account.");
        }
        String email = emailFromGoogle.trim().toLowerCase();

        Optional<AppUser> existing = userRepository.findByEmailIgnoreCase(email);
        if (existing.isPresent()) {
            AppUser user = existing.get();
            if (user.isBlocked()) {
                throw new BusinessException("Your account has been blocked.");
            }
            return issueAuthResponseTokens(user);
        }

        AppUser created = AppUser.builder()
                .username(nextUniqueOAuthUsername(email))
                .email(email)
                .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                .roles(roleManagementService.resolveRoles(Set.of(DEFAULT_SELF_REGISTER_ROLE)))
                .isBlocked(false)
                .build();
        created = userRepository.save(created);
        return issueAuthResponseTokens(created);
    }

    private String nextUniqueOAuthUsername(String emailNormalized) {
        int at = emailNormalized.indexOf('@');
        String local = at > 0 ? emailNormalized.substring(0, at) : emailNormalized;
        String base = local.replaceAll("[^a-zA-Z0-9_]", "_");
        if (base.isBlank()) {
            base = "guest";
        }
        String candidate = base;
        int suffix = 0;
        while (userRepository.existsByUsername(candidate)) {
            suffix++;
            candidate = base + "_" + suffix;
        }
        return candidate;
    }

    private AuthResponse issueAuthResponseTokens(AppUser user) {
        String jwtToken = jwtService.generateToken(user);
        return toAuthResponse(user, jwtToken);
    }

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
                jwtService.getAccessTokenExpiresInSeconds(),
                user.getEmail()
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
                jwtService.getAccessTokenExpiresInSeconds(),
                user.getEmail()
        );
    }
}