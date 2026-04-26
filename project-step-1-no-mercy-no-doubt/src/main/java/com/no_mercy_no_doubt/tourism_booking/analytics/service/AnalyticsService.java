package com.no_mercy_no_doubt.tourism_booking.analytics.service;

import com.no_mercy_no_doubt.tourism_booking.analytics.dto.*;
import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.auth.repository.AppUserRepository;
import com.no_mercy_no_doubt.tourism_booking.auth.service.RoleManagementService;
import com.no_mercy_no_doubt.tourism_booking.catalog.Booking.Booking;
import com.no_mercy_no_doubt.tourism_booking.catalog.Booking.BookingRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.Booking.BookingStatus;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.Hotel;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.HotelRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.Payment.Payment;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomType;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeRepository;
import com.no_mercy_no_doubt.tourism_booking.common.exception.ResourceNotFoundException;
import com.no_mercy_no_doubt.tourism_booking.common.utils.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AnalyticsService {

    private final HotelRepository hotelRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final BookingRepository bookingRepository;
    private final AppUserRepository appUserRepository;
    private final CurrentUserProvider currentUserProvider;
    private final RoleManagementService roleManagementService;

    public ManagerDashboardResponse getManagerDashboard(Long managerId) {
        ensureCanAccessManagerDashboard(managerId);

        List<Hotel> hotels = hotelRepository.findByManagerId(managerId);

        List<ManagerHotelSummaryResponse> hotelSummaries = hotels.stream()
                .map(this::buildManagerHotelSummary)
                .toList();

        List<Long> hotelIds = hotels.stream()
                .map(Hotel::getId)
                .toList();

        List<ManagerBookingDetailsResponse> recentBookings = hotelIds.isEmpty()
                ? List.of()
                : bookingRepository.findByHotelIdInOrderByCreatedAtDesc(hotelIds).stream()
                .limit(10)
                .map(this::mapToManagerBookingDetails)
                .toList();

        List<ManagerBookingDetailsResponse> pendingBookingsList = hotelIds.isEmpty()
                ? List.of()
                : bookingRepository.findByHotelIdInAndStatusOrderByCreatedAtDesc(hotelIds, BookingStatus.PENDING).stream()
                .limit(10)
                .map(this::mapToManagerBookingDetails)
                .toList();

        List<ManagerBookingDetailsResponse> upcomingBookings = hotelIds.isEmpty()
                ? List.of()
                : bookingRepository.findByHotelIdInAndStartDateGreaterThanEqualOrderByStartDateAsc(hotelIds, LocalDate.now()).stream()
                .limit(10)
                .map(this::mapToManagerBookingDetails)
                .toList();

        return ManagerDashboardResponse.builder()
                .managerId(managerId)
                .hotelsCount(hotels.size())
                .totalBookings(sumLong(hotelSummaries, ManagerHotelSummaryResponse::getTotalBookings))
                .pendingBookings(sumLong(hotelSummaries, ManagerHotelSummaryResponse::getPendingBookings))
                .confirmedBookings(sumLong(hotelSummaries, ManagerHotelSummaryResponse::getConfirmedBookings))
                .cancelledBookings(sumLong(hotelSummaries, ManagerHotelSummaryResponse::getCancelledBookings))
                .totalRevenue(sumBigDecimal(hotelSummaries, ManagerHotelSummaryResponse::getTotalRevenue))
                .hotels(hotelSummaries)
                .recentBookings(recentBookings)
                .pendingBookingsList(pendingBookingsList)
                .upcomingBookings(upcomingBookings)
                .build();
    }

    public HotelAnalyticsResponse getHotelAnalytics(Long hotelId) {
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ResourceNotFoundException("Hotel", hotelId));

        ensureCanAccessHotel(hotel);

        List<RoomPerformanceResponse> roomPerformance = getRoomPerformance(hotelId);

        return HotelAnalyticsResponse.builder()
                .hotelId(hotel.getId())
                .hotelName(hotel.getName())
                .totalBookings(sumLong(roomPerformance, RoomPerformanceResponse::getTotalBookings))
                .pendingBookings(sumLong(roomPerformance, RoomPerformanceResponse::getPendingBookings))
                .confirmedBookings(sumLong(roomPerformance, RoomPerformanceResponse::getConfirmedBookings))
                .cancelledBookings(sumLong(roomPerformance, RoomPerformanceResponse::getCancelledBookings))
                .totalRevenue(sumBigDecimal(roomPerformance, RoomPerformanceResponse::getGeneratedRevenue))
                .mostBookedRoom(findMostBookedRoom(roomPerformance))
                .leastBookedRoom(findLeastBookedRoom(roomPerformance))
                .rooms(roomPerformance)
                .build();
    }

    public List<RoomPerformanceResponse> getRoomPerformance(Long hotelId) {
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ResourceNotFoundException("Hotel", hotelId));

        ensureCanAccessHotel(hotel);

        List<RoomType> roomTypes = roomTypeRepository.findByHotelId(hotel.getId());
        List<RoomPerformanceResponse> performanceResponses = new ArrayList<>();

        for (RoomType roomType : roomTypes) {
            long pending = bookingRepository.countByHotelIdAndRoomTypeIdAndStatus(
                    hotelId, roomType.getId(), BookingStatus.PENDING
            );

            long confirmed = bookingRepository.countByHotelIdAndRoomTypeIdAndStatus(
                    hotelId, roomType.getId(), BookingStatus.CONFIRMED
            );

            long cancelled = bookingRepository.countByHotelIdAndRoomTypeIdAndStatus(
                    hotelId, roomType.getId(), BookingStatus.CANCELLED
            );

            BigDecimal revenue = defaultZero(
                    bookingRepository.sumRevenueByHotelIdAndRoomTypeIdAndStatus(
                            hotelId, roomType.getId(), BookingStatus.CONFIRMED
                    )
            );

            performanceResponses.add(
                    RoomPerformanceResponse.builder()
                            .roomTypeId(roomType.getId())
                            .roomTypeName(roomType.getName())
                            .inventoryCount(roomType.getInventoryCount())
                            .pendingBookings(pending)
                            .confirmedBookings(confirmed)
                            .cancelledBookings(cancelled)
                            .totalBookings(pending + confirmed + cancelled)
                            .generatedRevenue(revenue)
                            .build()
            );
        }

        return performanceResponses.stream()
                .sorted(Comparator.comparing(RoomPerformanceResponse::getTotalBookings).reversed()
                        .thenComparing(RoomPerformanceResponse::getRoomTypeId))
                .toList();
    }

    private ManagerHotelSummaryResponse buildManagerHotelSummary(Hotel hotel) {
        List<RoomPerformanceResponse> roomPerformance = getRoomPerformance(hotel.getId());

        return ManagerHotelSummaryResponse.builder()
                .hotelId(hotel.getId())
                .hotelName(hotel.getName())
                .totalBookings(sumLong(roomPerformance, RoomPerformanceResponse::getTotalBookings))
                .pendingBookings(sumLong(roomPerformance, RoomPerformanceResponse::getPendingBookings))
                .confirmedBookings(sumLong(roomPerformance, RoomPerformanceResponse::getConfirmedBookings))
                .cancelledBookings(sumLong(roomPerformance, RoomPerformanceResponse::getCancelledBookings))
                .totalRevenue(sumBigDecimal(roomPerformance, RoomPerformanceResponse::getGeneratedRevenue))
                .mostBookedRoom(findMostBookedRoom(roomPerformance))
                .build();
    }

    private ManagerBookingDetailsResponse mapToManagerBookingDetails(Booking booking) {
        Hotel hotel = hotelRepository.findById(booking.getHotelId()).orElse(null);
        RoomType roomType = roomTypeRepository.findById(booking.getRoomTypeId()).orElse(null);
        AppUser guest = appUserRepository.findById(booking.getGuestId()).orElse(null);
        Payment payment = booking.getPayment();

        return ManagerBookingDetailsResponse.builder()
                .bookingId(booking.getId())
                .guestId(booking.getGuestId())
                .guestName(guest != null ? guest.getUsername() : null)
                .guestEmail(guest != null ? guest.getEmail() : null)
                .hotelId(booking.getHotelId())
                .hotelName(hotel != null ? hotel.getName() : null)
                .roomTypeId(booking.getRoomTypeId())
                .roomTypeName(roomType != null ? roomType.getName() : null)
                .startDate(booking.getStartDate())
                .endDate(booking.getEndDate())
                .totalPrice(booking.getTotalPrice())
                .bookingStatus(booking.getStatus())
                .paymentStatus(payment != null && payment.getStatus() != null ? payment.getStatus() : null)
                .createdAt(booking.getCreatedAt())
                .build();
    }

    private RoomBookingInsight findMostBookedRoom(List<RoomPerformanceResponse> roomPerformance) {
        return roomPerformance.stream()
                .filter(room -> room.getTotalBookings() > 0)
                .max(Comparator.comparing(RoomPerformanceResponse::getTotalBookings)
                        .thenComparing(RoomPerformanceResponse::getConfirmedBookings)
                        .thenComparing(RoomPerformanceResponse::getRoomTypeId))
                .map(this::toInsight)
                .orElse(null);
    }

    private RoomBookingInsight findLeastBookedRoom(List<RoomPerformanceResponse> roomPerformance) {
        return roomPerformance.stream()
                .filter(room -> room.getTotalBookings() > 0)
                .min(Comparator.comparing(RoomPerformanceResponse::getTotalBookings)
                        .thenComparing(RoomPerformanceResponse::getRoomTypeId))
                .map(this::toInsight)
                .orElse(null);
    }

    private RoomBookingInsight toInsight(RoomPerformanceResponse roomPerformanceResponse) {
        return RoomBookingInsight.builder()
                .roomTypeId(roomPerformanceResponse.getRoomTypeId())
                .roomTypeName(roomPerformanceResponse.getRoomTypeName())
                .bookingCount(roomPerformanceResponse.getTotalBookings())
                .build();
    }

    private void ensureCanAccessManagerDashboard(Long managerId) {
        AppUser currentUser = currentUserProvider.getCurrentUser();

        if (isAdmin(currentUser)) {
            return;
        }

        if (isManager(currentUser) && currentUser.getId().equals(managerId)) {
            return;
        }

        throw new AccessDeniedException("You are not allowed to access this dashboard.");
    }

    private void ensureCanAccessHotel(Hotel hotel) {
        AppUser currentUser = currentUserProvider.getCurrentUser();

        if (isAdmin(currentUser)) {
            return;
        }

        if (isManager(currentUser) && hotel.getManagerId() != null && hotel.getManagerId().equals(currentUser.getId())) {
            return;
        }

        throw new AccessDeniedException("You are not allowed to access this hotel's analytics.");
    }

    private boolean isAdmin(AppUser user) {
        return roleManagementService.userHasRole(user, "ADMIN");
    }

    private boolean isManager(AppUser user) {
        return roleManagementService.userHasRole(user, "MANAGER");
    }

    private <T> long sumLong(List<T> values, Function<T, Long> extractor) {
        return values.stream()
                .map(extractor)
                .filter(v -> v != null)
                .mapToLong(Long::longValue)
                .sum();
    }

    private <T> BigDecimal sumBigDecimal(List<T> values, Function<T, BigDecimal> extractor) {
        return values.stream()
                .map(extractor)
                .filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal defaultZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }
}