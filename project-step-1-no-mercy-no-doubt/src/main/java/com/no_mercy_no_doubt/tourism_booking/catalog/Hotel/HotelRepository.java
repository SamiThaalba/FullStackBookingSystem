package com.no_mercy_no_doubt.tourism_booking.catalog.Hotel;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface HotelRepository extends JpaRepository<Hotel, Long> {

    List<Hotel> findByManagerId(Long managerId);

    List<Hotel> findByOwnerId(Long ownerId);

    @Query("SELECT h FROM Hotel h WHERE h.ownerId = :userId OR h.managerId = :userId")
    List<Hotel> findByOwnerIdOrManagerId(@Param("userId") Long userId);

    /**
     * Filter by city/country through normalized tables only.
     * Patterns are pre-wrapped with {@code %} in Java ({@link HotelService#listHotelsWithFilters}).
     * {@code CAST(... AS string)} forces text in SQL: some PostgreSQL schemas still store these
     * {@code name} columns as {@code bytea}; {@code lower(bytea)} is invalid without a cast.
     */
    @Query(
            value = """
                    SELECT h FROM Hotel h
                    LEFT JOIN h.locatedCity c
                    LEFT JOIN c.country co
                    WHERE (:cityPattern IS NULL OR (c IS NOT NULL AND LOWER(CAST(c.name AS string)) LIKE LOWER(CAST(:cityPattern AS string))))
                      AND (:countryPattern IS NULL OR (co IS NOT NULL AND LOWER(CAST(co.name AS string)) LIKE LOWER(CAST(:countryPattern AS string))))
                      AND (:namePattern IS NULL OR LOWER(CAST(h.name AS string)) LIKE LOWER(CAST(:namePattern AS string)))
                    """,
            countQuery = """
                    SELECT COUNT(h) FROM Hotel h
                    LEFT JOIN h.locatedCity c
                    LEFT JOIN c.country co
                    WHERE (:cityPattern IS NULL OR (c IS NOT NULL AND LOWER(CAST(c.name AS string)) LIKE LOWER(CAST(:cityPattern AS string))))
                      AND (:countryPattern IS NULL OR (co IS NOT NULL AND LOWER(CAST(co.name AS string)) LIKE LOWER(CAST(:countryPattern AS string))))
                      AND (:namePattern IS NULL OR LOWER(CAST(h.name AS string)) LIKE LOWER(CAST(:namePattern AS string)))
                    """
    )
    Page<Hotel> findByFilters(
            @Param("cityPattern") String cityPattern,
            @Param("countryPattern") String countryPattern,
            @Param("namePattern") String namePattern,
            Pageable pageable
    );
}
