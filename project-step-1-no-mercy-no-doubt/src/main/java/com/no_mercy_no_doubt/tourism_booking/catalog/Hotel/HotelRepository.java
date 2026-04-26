package com.no_mercy_no_doubt.tourism_booking.catalog.Hotel;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface HotelRepository extends JpaRepository<Hotel, Long> {

    List<Hotel> findByManagerId(Long managerId);

    @Query(
            value = """
            SELECT *
            FROM hotels h
            WHERE (:city IS NULL OR h.city ILIKE CAST(:city AS text))
              AND (:country IS NULL OR h.country ILIKE CAST(:country AS text))
              AND (:name IS NULL OR h.name ILIKE CONCAT('%', CAST(:name AS text), '%'))
            """,
            countQuery = """
            SELECT COUNT(*)
            FROM hotels h
            WHERE (:city IS NULL OR h.city ILIKE CAST(:city AS text))
              AND (:country IS NULL OR h.country ILIKE CAST(:country AS text))
              AND (:name IS NULL OR h.name ILIKE CONCAT('%', CAST(:name AS text), '%'))
            """,
            nativeQuery = true
    )

    Page<Hotel> findByFilters(
            @Param("city") String city,
            @Param("country") String country,
            @Param("name") String name,
            Pageable pageable
    );

}