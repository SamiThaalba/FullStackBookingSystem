package com.no_mercy_no_doubt.tourism_booking.auth.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Preserves the SPA "from" redirect path across the OAuth2 round trip (session-backed).
 */
@Component
public class OAuth2FromSessionFilter extends OncePerRequestFilter {

    public static final String SESSION_ATTR_FROM = "OAUTH_LOGIN_FROM";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if ("/oauth2/authorization/google".equals(request.getRequestURI())) {
            String from = request.getParameter("from");
            if (from != null && !from.isBlank()) {
                request.getSession(true).setAttribute(SESSION_ATTR_FROM, from);
            }
        }
        filterChain.doFilter(request, response);
    }
}
