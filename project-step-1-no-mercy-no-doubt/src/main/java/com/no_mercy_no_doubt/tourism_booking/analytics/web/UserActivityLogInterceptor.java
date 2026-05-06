package com.no_mercy_no_doubt.tourism_booking.analytics.web;

import com.no_mercy_no_doubt.tourism_booking.analytics.service.UserActivityLogService;
import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.common.utils.CurrentUserProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class UserActivityLogInterceptor implements HandlerInterceptor {

    private static final Pattern RESOURCE_PATTERN = Pattern.compile("^/api/([^/]+)(?:/([^/]+))?.*$");

    private final CurrentUserProvider currentUserProvider;
    private final UserActivityLogService logService;

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        if (response.getStatus() >= 400) {
            return;
        }

        String path = request.getRequestURI();
        if (!path.startsWith("/api/") || path.startsWith("/api/auth")) {
            return;
        }
        if (!isManagerActivityPath(path)) {
            return;
        }

        try {
            AppUser currentUser = currentUserProvider.getCurrentUser();
            String actionType = mapActionType(request.getMethod());
            if (actionType == null) {
                return;
            }
            String resourceType = null;
            String resourceId = null;

            Matcher matcher = RESOURCE_PATTERN.matcher(path);
            if (matcher.matches()) {
                resourceType = matcher.group(1);
                resourceId = matcher.group(2);
            }

            logService.logRequest(
                    currentUser,
                    actionType,
                    request.getMethod(),
                    path,
                    resourceType,
                    resourceId
            );
        } catch (RuntimeException ignored) {
            // Logging must never break request flow.
        }
    }

    private String mapActionType(String method) {
        if ("POST".equalsIgnoreCase(method)) return "CREATE";
        if ("PUT".equalsIgnoreCase(method) || "PATCH".equalsIgnoreCase(method)) return "UPDATE";
        if ("DELETE".equalsIgnoreCase(method)) return "DELETE";
        return null;
    }

    private boolean isManagerActivityPath(String path) {
        return path.startsWith("/api/hotels")
                || path.startsWith("/api/room-type")
                || path.startsWith("/api/bookings")
                || path.startsWith("/api/payments");
    }
}
