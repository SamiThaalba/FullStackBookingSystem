package com.no_mercy_no_doubt.tourism_booking.auth.web;

import com.no_mercy_no_doubt.tourism_booking.auth.dto.AuthResponse;
import com.no_mercy_no_doubt.tourism_booking.auth.service.AuthService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class SpaOAuth2AuthenticationSuccessHandler implements AuthenticationSuccessHandler {

    private final AuthService authService;

    @Value("${app.oauth.frontend-callback-base}")
    private String frontendCallbackBase;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
            Authentication authentication) throws IOException, ServletException {
        OAuth2User oauthUser = (OAuth2User) authentication.getPrincipal();
        String email = oauthUser.getAttribute("email");
        AuthResponse tokens = authService.loginOrRegisterFromGoogleOAuth(email);

        String from = (String) request.getSession().getAttribute(OAuth2FromSessionFilter.SESSION_ATTR_FROM);
        if (from == null || from.isBlank()) {
            from = "/hotels";
        }
        request.getSession().removeAttribute(OAuth2FromSessionFilter.SESSION_ATTR_FROM);

        String redirect = UriComponentsBuilder.fromUriString(frontendCallbackBase)
                .queryParam("token", tokens.accessToken())
                .queryParam("refreshToken", tokens.refreshToken())
                .queryParam("tokenType", tokens.tokenType())
                .queryParam("expiresInSeconds", tokens.expiresInSeconds())
                .queryParam("from", from)
                .build(false)
                .encode()
                .toUriString();

        response.sendRedirect(redirect);
    }
}
