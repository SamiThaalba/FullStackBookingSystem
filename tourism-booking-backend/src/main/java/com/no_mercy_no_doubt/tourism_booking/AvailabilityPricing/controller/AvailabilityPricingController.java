package com.no_mercy_no_doubt.tourism_booking.AvailabilityPricing.controller;

import com.no_mercy_no_doubt.tourism_booking.AvailabilityPricing.dto.AvailabilityCheckRequest;
import com.no_mercy_no_doubt.tourism_booking.AvailabilityPricing.dto.AvailabilityCheckResponse;
import com.no_mercy_no_doubt.tourism_booking.AvailabilityPricing.service.AvailabilityPricingService;
import com.no_mercy_no_doubt.tourism_booking.catalog.Booking.BookingRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomType;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeResponse;
import com.no_mercy_no_doubt.tourism_booking.common.exception.ResourceNotFoundException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/availability")
@RequiredArgsConstructor
@Tag(name = "Availability & Pricing", description = "Check availability by date range and guests, get price")
public class AvailabilityPricingController {

    private final RoomTypeRepository roomTypeRepository;
    private final BookingRepository bookingRepository;
    private final AvailabilityPricingService availabilityPricingService;

    @GetMapping
    @Operation(summary = "Return available rooms list by date range and guests")
    public ResponseEntity<List<RoomTypeResponse>> getAvailableRooms(
            @RequestParam("from")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate from,

            @RequestParam("to")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate to,

            @RequestParam("guests")
            Integer guests
    ) {
        List<RoomType> roomTypes = roomTypeRepository.findAll();

        List<RoomTypeResponse> availableRooms = availabilityPricingService.getAvailableRooms(
                roomTypes,
                from,
                to,
                guests,
                (roomTypeId, startDate, endDate) ->
                        bookingRepository.countActiveOverlappingBookings(roomTypeId, startDate, endDate)
        );

        return ResponseEntity.ok(availableRooms);
    }

    @PostMapping("/check")
    @Operation(summary = "Check availability and get total price")
    public ResponseEntity<AvailabilityCheckResponse> checkAvailability(@Valid @RequestBody AvailabilityCheckRequest request) {
        RoomType roomType = roomTypeRepository.findById(request.roomTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", request.roomTypeId()));

        long overlapping = bookingRepository.countActiveOverlappingBookings(
                request.roomTypeId(),
                request.checkIn(),
                request.checkOut()
        );

        int inventoryCount = roomType.getInventoryCount();

        AvailabilityCheckResponse response = availabilityPricingService.checkAvailability(
                roomType.getBasePrice(),
                roomType.getCapacity(),
                inventoryCount,
                request.checkIn(),
                request.checkOut(),
                request.numberOfGuests(),
                overlapping
        );

        return ResponseEntity.ok(response);
    }
}