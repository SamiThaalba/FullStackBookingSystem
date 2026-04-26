package com.no_mercy_no_doubt.tourism_booking.catalog.Booking;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDate;
@Data
public class BookingRequest {
    @NotNull
    private Long hotelId;

    @NotNull
    private Long roomTypeId;

    @NotNull
    @FutureOrPresent
    private LocalDate startDate;

    @NotNull
    @Future
    private LocalDate endDate;
}
