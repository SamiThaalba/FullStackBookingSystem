package com.no_mercy_no_doubt.tourism_booking.analytics.dto;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;

@Value
@Builder
public class UserActivityLogResponse {
    Long id;
    Long userId;
    String username;
    String actionType;
    String httpMethod;
    String endpoint;
    String resourceType;
    String resourceId;
    LocalDateTime createdAt;
}
