package com.no_mercy_no_doubt.tourism_booking.wishlist.repository;

import com.no_mercy_no_doubt.tourism_booking.wishlist.entity.PriceAvailabilityAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PriceAvailabilityAlertRepository extends JpaRepository<PriceAvailabilityAlert, Long> {

    List<PriceAvailabilityAlert> findByUserIdOrderByCreatedAtDesc(Long userId);

    @Query("""
            SELECT DISTINCT a FROM PriceAvailabilityAlert a
            JOIN FETCH a.user
            JOIN FETCH a.roomType rt
            LEFT JOIN FETCH rt.hotel
            WHERE a.active = true AND rt.id = :roomTypeId
            """)
    List<PriceAvailabilityAlert> findByRoomTypeIdAndActiveTrueWithAssociations(@Param("roomTypeId") Long roomTypeId);

    @Query("SELECT a.id FROM PriceAvailabilityAlert a WHERE a.active = true AND a.triggered = false")
    List<Long> findIdsByActiveTrueAndTriggeredFalse();

    @Query("""
            SELECT a FROM PriceAvailabilityAlert a
            JOIN FETCH a.user
            JOIN FETCH a.roomType rt
            LEFT JOIN FETCH rt.hotel
            WHERE a.id = :id
            """)
    Optional<PriceAvailabilityAlert> findByIdWithAssociations(@Param("id") Long id);

    Optional<PriceAvailabilityAlert> findByIdAndUserId(Long id, Long userId);
}
