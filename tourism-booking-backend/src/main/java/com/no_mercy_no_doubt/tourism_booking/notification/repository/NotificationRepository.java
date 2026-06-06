package com.no_mercy_no_doubt.tourism_booking.notification.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<com.no_mercy_no_doubt.tourism_booking.notification.entity.Notification, Long> {

    List<com.no_mercy_no_doubt.tourism_booking.notification.entity.Notification> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<com.no_mercy_no_doubt.tourism_booking.notification.entity.Notification> findByIdAndUserId(Long id, Long userId);

    long countByUserIdAndReadFalse(Long userId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Notification n SET n.read = true WHERE n.user.id = :userId AND n.read = false")
    int markAllReadForUser(@Param("userId") Long userId);
}