package com.no_mercy_no_doubt.tourism_booking.catalog.Booking;
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
    private LocalDate startDate;

    @NotNull
    private LocalDate endDate;
}
