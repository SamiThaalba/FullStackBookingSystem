package com.no_mercy_no_doubt.tourism_booking.AvailabilityPricing.service;

import com.no_mercy_no_doubt.tourism_booking.AvailabilityPricing.dto.AvailabilityCheckResponse;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.CatalogMapper;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomType;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeResponse;
import com.no_mercy_no_doubt.tourism_booking.DynamicPricing.PricingService;
import com.no_mercy_no_doubt.tourism_booking.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AvailabilityPricingService {

    private static final double WEEKEND_MULTIPLIER = 1.2;

    private final CatalogMapper catalogMapper;
    private final PricingService pricingService;


    public AvailabilityCheckResponse checkAvailability(
            BigDecimal basePricePerNight,
            int capacity,
            int inventoryCount,
            LocalDate checkIn,
            LocalDate checkOut,
            int numberOfGuests,
            long overlappingBookingsCount) {


        return checkAvailability(
                basePricePerNight,
                capacity,
                inventoryCount,
                checkIn,
                checkOut,
                numberOfGuests,
                overlappingBookingsCount,
                null
        );
    }


    public AvailabilityCheckResponse checkAvailability(
            BigDecimal basePricePerNight,
            int capacity,
            int inventoryCount,
            LocalDate checkIn,
            LocalDate checkOut,
            int numberOfGuests,
            long overlappingBookingsCount,
            Long roomTypeId) {

        boolean capacityOk = numberOfGuests <= capacity;
        boolean datesOk = checkOut.isAfter(checkIn);
        boolean available = capacityOk && datesOk && overlappingBookingsCount < inventoryCount;

        BigDecimal totalPrice = available
                ? calculateTotalPrice(basePricePerNight, checkIn, checkOut, roomTypeId)
                : null;

        String message = !datesOk ? "Invalid date range"
                : !capacityOk ? "Guests exceed capacity"
                : overlappingBookingsCount >= inventoryCount ? "No availability"
                : "Available";

        return new AvailabilityCheckResponse(
                available,
                totalPrice,
                message
        );
    }

    public List<RoomTypeResponse> getAvailableRooms(
            List<RoomType> roomTypes,
            LocalDate from,
            LocalDate to,
            int guests,
            OverlapCounter overlapCounter
    ) {
        validateAvailabilitySearch(from, to, guests);

        return roomTypes.stream()
                .filter(roomType -> roomType.getCapacity() >= guests)
                .filter(roomType -> {
                    long overlapping = overlapCounter.count(roomType.getId(), from, to);
                    return overlapping < roomType.getInventoryCount();
                })
                .map(catalogMapper::toRoomTypeResponse)
                .toList();
    }


    public BigDecimal calculateTotalPrice(
            BigDecimal basePricePerNight,
            LocalDate checkIn,
            LocalDate checkOut) {

        return calculateTotalPrice(basePricePerNight, checkIn, checkOut, null);
    }


    public BigDecimal calculateTotalPrice(
            BigDecimal basePricePerNight,
            LocalDate checkIn,
            LocalDate checkOut,
            Long roomTypeId) {

        long nights = ChronoUnit.DAYS.between(checkIn, checkOut);
        if (nights <= 0) return BigDecimal.ZERO;

        BigDecimal total = BigDecimal.ZERO;
        LocalDate date = checkIn;

        while (date.isBefore(checkOut)) {

            boolean isWeekend = date.getDayOfWeek() == DayOfWeek.SATURDAY
                    || date.getDayOfWeek() == DayOfWeek.SUNDAY;


            double multiplier = isWeekend ? WEEKEND_MULTIPLIER : 1.0;


            if (roomTypeId != null) {
                double dynamicMultiplier = pricingService.getMultiplier(roomTypeId, date);
                multiplier *= dynamicMultiplier;
            }

            total = total.add(
                    basePricePerNight.multiply(BigDecimal.valueOf(multiplier))
            );

            date = date.plusDays(1);
        }

        return total.setScale(2, RoundingMode.HALF_UP);
    }

    private void validateAvailabilitySearch(LocalDate from, LocalDate to, int guests) {
        if (from == null || to == null) {
            throw new BusinessException("From date and to date are required");
        }
        if (!to.isAfter(from)) {
            throw new BusinessException("To date must be after from date");
        }
        if (from.isBefore(LocalDate.now())) {
            throw new BusinessException("From date cannot be in the past");
        }
        if (guests < 1) {
            throw new BusinessException("Guests must be at least 1");
        }
    }

    @FunctionalInterface
    public interface OverlapCounter {
        long count(Long roomTypeId, LocalDate from, LocalDate to);
    }
}