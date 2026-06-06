package com.no_mercy_no_doubt.tourism_booking.analytics.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_activity_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserActivityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 150)
    private String username;

    @Column(nullable = false, length = 50)
    private String actionType;

    @Column(nullable = false, length = 12)
    private String httpMethod;

    @Column(nullable = false, length = 255)
    private String endpoint;

    @Column(length = 100)
    private String resourceType;

    @Column(length = 100)
    private String resourceId;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
