package com.no_mercy_no_doubt.tourism_booking.auth.service;

import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import java.util.function.Function;

@Service
public class JwtService {

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.expiration-ms}")
    private long jwtExpirationMs;

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    public String generateToken(AppUser user) {
        java.util.List<String> roles = user.getRoles().stream()
                .map(com.no_mercy_no_doubt.tourism_booking.auth.entity.Role::getName)
                .distinct()
                .sorted()
                .toList();

        java.util.List<String> permissions = user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(com.no_mercy_no_doubt.tourism_booking.auth.entity.Permission::getName)
                .distinct()
                .sorted()
                .toList();

        return generateToken(
                Map.of(
                        "id", user.getId(),
                        "email", user.getEmail(),
                        "roles", roles,
                        "permissions", permissions
                ),
                user.getUsername()
        );
    }

    public String generateToken(Map<String, Object> extraClaims, String username) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + jwtExpirationMs);
        return Jwts.builder()
                .subject(username)
                .claims(extraClaims)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(getSigningKey())
                .compact();
    }

    public boolean isTokenValid(String token, String username) {
        final String extractedUsername = extractUsername(token);
        return extractedUsername.equals(username) && !isTokenExpired(token);
    }

    public long getAccessTokenExpiresInSeconds() {
        return jwtExpirationMs / 1000;
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}