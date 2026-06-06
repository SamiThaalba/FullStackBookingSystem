package com.no_mercy_no_doubt.tourism_booking.catalog.Booking;

import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class BookingMapper {

    public BookingResponse toResponse(Booking booking) {
        BookingResponse response = new BookingResponse();
        response.setId(booking.getId());
        response.setHotelId(booking.getHotelId());
        response.setRoomTypeId(booking.getRoomTypeId());
        response.setGuestId(booking.getGuestId());
        response.setStartDate(booking.getStartDate());
        response.setEndDate(booking.getEndDate());
        response.setStatus(booking.getStatus());
        response.setTotalPrice(booking.getTotalPrice());
        return response;
    }

    public Booking toEntity(BookingRequest request, Long guestId) {
        Booking booking = new Booking();
        booking.setHotelId(request.getHotelId());
        booking.setRoomTypeId(request.getRoomTypeId());
        booking.setGuestId(guestId);
        booking.setStartDate(request.getStartDate());
        booking.setEndDate(request.getEndDate());
        booking.setStatus(BookingStatus.PENDING);
        booking.setCreatedAt(LocalDateTime.now());
        return booking;
    }
}