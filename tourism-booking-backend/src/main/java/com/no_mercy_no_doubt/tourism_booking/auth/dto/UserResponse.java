package com.no_mercy_no_doubt.tourism_booking.auth.dto;

import lombok.Builder;
import lombok.Data;

import java.util.Set;

@Data
@Builder
public class UserResponse {
    private Long id;
    private String username;
    private String email;
    private String avatarUrl;
    private Set<String> roles;
    private Set<String> permissions;
    private boolean blocked;
}
