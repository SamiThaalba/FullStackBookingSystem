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

import java.net.URI;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

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

    private static final int OAUTH_USERNAME_MAX_LEN = 48;
    private static final Pattern EMAIL_LOCAL_SUFFIX = Pattern.compile("[1-9]\\d*");

    /**
     * Find or provision a CUSTOMER linked to Google's verified profile and return API tokens for the SPA.
     *
     * @param fullNameFromGoogle optional display name from Google (e.g. {@code name} claim); used for username
     *                           instead of the numeric email local-part when present.
     */
    @Transactional
    public AuthResponse loginOrRegisterFromGoogleOAuth(String emailFromGoogle, String fullNameFromGoogle) {
        if (emailFromGoogle == null || emailFromGoogle.isBlank()) {
            throw new BusinessException("Google did not share an email for this account.");
        }
        String email = emailFromGoogle.trim().toLowerCase(Locale.ROOT);
        String displayName = fullNameFromGoogle == null ? null : fullNameFromGoogle.trim();
        if (displayName != null && displayName.isEmpty()) {
            displayName = null;
        }

        Optional<AppUser> existing = userRepository.findByEmailIgnoreCase(email);
        if (existing.isPresent()) {
            AppUser user = existing.get();
            if (user.isBlocked()) {
                throw new BusinessException("Your account has been blocked.");
            }
            maybeUpgradeUsernameFromGoogleProfile(user, email, displayName);
            return issueAuthResponseTokens(user);
        }

        String username = resolveNewOAuthUsername(email, displayName);
        AppUser created = AppUser.builder()
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                .roles(roleManagementService.resolveRoles(Set.of(DEFAULT_SELF_REGISTER_ROLE)))
                .isBlocked(false)
                .build();
        created = userRepository.save(created);
        return issueAuthResponseTokens(created);
    }

    /**
     * Users first created with only email used to get usernames like {@code 202303998}; replace with Google's
     * display name when Google sends one and the stored username still matches the legacy email-local pattern.
     */
    private void maybeUpgradeUsernameFromGoogleProfile(AppUser user, String emailNormalized, String displayName) {
        if (displayName == null || displayName.isBlank()) {
            return;
        }
        String spacedFromGoogle = sanitizeDisplayNameAsUsername(displayName);
        if (spacedFromGoogle == null) {
            return;
        }
        boolean legacyEmailUsername = wasDerivedFromEmailLocal(user.getUsername(), emailNormalized);
        boolean oldUnderscoreSameName =
                normalizeUsernameSpaces(user.getUsername().replace('_', ' ')).equalsIgnoreCase(spacedFromGoogle);
        if (!legacyEmailUsername && !oldUnderscoreSameName) {
            return;
        }
        String upgraded = nextUniqueOAuthUsernameFromDisplayName(displayName, user.getId());
        if (upgraded == null || upgraded.equalsIgnoreCase(user.getUsername())) {
            return;
        }
        user.setUsername(upgraded);
        userRepository.save(user);
    }

    private static String normalizeUsernameSpaces(String s) {
        if (s == null) {
            return "";
        }
        return s.replaceAll("\\s+", " ").trim();
    }

    private String resolveNewOAuthUsername(String emailNormalized, String displayName) {
        String fromName = nextUniqueOAuthUsernameFromDisplayName(displayName, null);
        if (fromName != null) {
            return fromName;
        }
        return nextUniqueOAuthUsernameFromEmail(emailNormalized);
    }

    private String nextUniqueOAuthUsernameFromEmail(String emailNormalized) {
        String base = emailLocalPartSanitized(emailNormalized);
        String candidate = base;
        int suffix = 0;
        while (userRepository.existsByUsername(candidate)) {
            suffix++;
            candidate = base + "_" + suffix;
        }
        return candidate;
    }

    /**
     * @param excludeUserId when non-null, that user's current username is ignored for collision checks (profile upgrade).
     */
    private String nextUniqueOAuthUsernameFromDisplayName(String rawDisplayName, Long excludeUserId) {
        String base = sanitizeDisplayNameAsUsername(rawDisplayName);
        if (base == null || base.isBlank()) {
            return null;
        }
        String candidate = base;
        int suffix = 0;
        while (isUsernameTakenBySomeoneElse(candidate, excludeUserId)) {
            suffix++;
            candidate = base + " " + suffix;
        }
        return candidate;
    }

    private boolean isUsernameTakenBySomeoneElse(String candidate, Long excludeUserId) {
        Optional<AppUser> holder = userRepository.findByUsername(candidate);
        if (holder.isEmpty()) {
            return false;
        }
        if (excludeUserId == null) {
            return true;
        }
        return !holder.get().getId().equals(excludeUserId);
    }

    private String emailLocalPartSanitized(String emailNormalized) {
        int at = emailNormalized.indexOf('@');
        String local = at > 0 ? emailNormalized.substring(0, at) : emailNormalized;
        String base = local.replaceAll("[^a-zA-Z0-9_]", "_");
        if (base.isBlank()) {
            base = "guest";
        }
        return base;
    }

    private boolean wasDerivedFromEmailLocal(String username, String emailNormalized) {
        if (username == null || emailNormalized == null) {
            return false;
        }
        String base = emailLocalPartSanitized(emailNormalized);
        if (username.equalsIgnoreCase(base)) {
            return true;
        }
        String prefix = base + "_";
        if (username.length() <= prefix.length() || !username.regionMatches(true, 0, prefix, 0, prefix.length())) {
            return false;
        }
        String rest = username.substring(prefix.length());
        return EMAIL_LOCAL_SUFFIX.matcher(rest).matches();
    }

    /**
     * Human-style username from Google name: letters/digits (any script), single spaces between tokens.
     */
    private String sanitizeDisplayNameAsUsername(String raw) {
        if (raw == null) {
            return null;
        }
        String s = raw.trim();
        if (s.isEmpty()) {
            return null;
        }
        String base = s.replaceAll("[^\\p{L}\\p{N}]+", " ").replaceAll("\\s+", " ").trim();
        if (base.isBlank()) {
            return null;
        }
        if (base.length() > OAUTH_USERNAME_MAX_LEN) {
            base = base.substring(0, OAUTH_USERNAME_MAX_LEN).replaceAll("\\s+$", "");
        }
        if (base.isBlank()) {
            return null;
        }
        return base;
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

    /**
     * Updates profile photo URL (Supabase public object URL) and returns fresh API tokens with the new claim.
     */
    @Transactional
    public AuthResponse updateAvatarUrl(String username, String rawAvatarUrl) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BusinessException("User was not found."));
        user.setAvatarUrl(normalizeAndValidateAvatarUrl(rawAvatarUrl));
        userRepository.save(user);
        return issueAuthResponseTokens(user);
    }

    private String normalizeAndValidateAvatarUrl(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String trimmed = raw.trim();
        validateSupabasePublicObjectUrl(trimmed);
        return trimmed;
    }

    private void validateSupabasePublicObjectUrl(String url) {
        try {
            URI u = URI.create(url);
            if (!"https".equalsIgnoreCase(u.getScheme())) {
                throw new BusinessException("Avatar URL must use HTTPS.");
            }
            String host = u.getHost();
            if (host == null || !host.toLowerCase(Locale.ROOT).endsWith("supabase.co")) {
                throw new BusinessException("Avatar must be stored on Supabase (supabase.co).");
            }
            String path = u.getPath() != null ? u.getPath() : "";
            if (!path.contains("/storage/v1/object/public/")) {
                throw new BusinessException("Avatar must use a Supabase Storage public object URL.");
            }
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("Invalid avatar URL.");
        }
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