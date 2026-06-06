package com.no_mercy_no_doubt.tourism_booking.catalog.Booking;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    List<Booking> findByGuestId(Long guestId);

    List<Booking> findByStatus(BookingStatus status);

    List<Booking> findByHotelIdIn(List<Long> hotelIds);

    List<Booking> findByHotelIdInAndStatus(List<Long> hotelIds, BookingStatus status);

    List<Booking> findByHotelIdAndStartDateGreaterThanEqualAndStatusNotOrderByStartDateAsc(
            Long hotelId,
            LocalDate startDate,
            BookingStatus status
    );

    List<Booking> findByStartDateGreaterThanEqualAndStatusNotOrderByStartDateAsc(
            LocalDate startDate,
            BookingStatus status
    );

    @Query("""
        SELECT COUNT(b)
        FROM Booking b
        WHERE b.roomTypeId = :roomTypeId
          AND b.status <> com.no_mercy_no_doubt.tourism_booking.catalog.Booking.BookingStatus.CANCELLED
          AND b.startDate < :endDate
          AND b.endDate > :startDate
    """)
    long countActiveOverlappingBookings(@Param("roomTypeId") Long roomTypeId,
                                        @Param("startDate") LocalDate startDate,
                                        @Param("endDate") LocalDate endDate);

    long countByHotelIdAndRoomTypeIdAndStatus(Long hotelId, Long roomTypeId, BookingStatus status);

    @Query("""
        SELECT COALESCE(SUM(b.totalPrice), 0)
        FROM Booking b
        WHERE b.hotelId = :hotelId
          AND b.roomTypeId = :roomTypeId
          AND b.status = :status
    """)
    BigDecimal sumRevenueByHotelIdAndRoomTypeIdAndStatus(@Param("hotelId") Long hotelId,
                                                         @Param("roomTypeId") Long roomTypeId,
                                                         @Param("status") BookingStatus status);

    List<Booking> findByHotelIdInOrderByCreatedAtDesc(List<Long> hotelIds);

    List<Booking> findByHotelIdInAndStatusOrderByCreatedAtDesc(List<Long> hotelIds, BookingStatus status);

    List<Booking> findByHotelIdInAndStartDateGreaterThanEqualOrderByStartDateAsc(
            List<Long> hotelIds,
            LocalDate startDate
    );

    @Query("""
        SELECT COUNT(b)
        FROM Booking b
        WHERE b.roomTypeId = :roomTypeId
          AND b.id <> :excludeBookingId
          AND b.status <> com.no_mercy_no_doubt.tourism_booking.catalog.Booking.BookingStatus.CANCELLED
          AND b.startDate < :endDate
          AND b.endDate > :startDate
    """)
    long countActiveOverlappingBookingsExcluding(
            @Param("roomTypeId") Long roomTypeId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("excludeBookingId") Long excludeBookingId
    );
}