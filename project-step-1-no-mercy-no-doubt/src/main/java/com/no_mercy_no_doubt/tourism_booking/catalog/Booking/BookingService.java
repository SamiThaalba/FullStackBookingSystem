package com.no_mercy_no_doubt.tourism_booking.catalog.Booking;

import com.no_mercy_no_doubt.tourism_booking.AvailabilityPricing.dto.AvailabilityCheckResponse;
import com.no_mercy_no_doubt.tourism_booking.AvailabilityPricing.service.AvailabilityPricingService;
import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.auth.service.RoleManagementService;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.Hotel;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.HotelRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomType;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeRepository;
import com.no_mercy_no_doubt.tourism_booking.common.exception.BusinessException;
import com.no_mercy_no_doubt.tourism_booking.common.exception.ResourceNotFoundException;
import com.no_mercy_no_doubt.tourism_booking.common.utils.CurrentUserProvider;
import com.no_mercy_no_doubt.tourism_booking.wishlist.service.AlertService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class BookingService {

    private final BookingRepository bookingRepository;
    private final BookingMapper bookingMapper;
    private final RoomTypeRepository roomTypeRepository;
    private final HotelRepository hotelRepository;
    private final AlertService alertService;
    private final AvailabilityPricingService availabilityPricingService;
    private final CurrentUserProvider currentUserProvider;
    private final RoleManagementService roleManagementService;

    public BookingResponse createBooking(BookingRequest request) {
        validateBookingRequest(request);

        AppUser currentUser = currentUserProvider.getCurrentUser();

        RoomType roomType = roomTypeRepository.findByIdForUpdate(request.getRoomTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", request.getRoomTypeId()));

        validateHotelRoomMatch(request.getHotelId(), roomType);
        validateAvailability(roomType, request.getStartDate(), request.getEndDate());

        Booking booking = bookingMapper.toEntity(request, currentUser.getId());
        booking.setStatus(BookingStatus.PENDING);

        BigDecimal totalPrice = availabilityPricingService.calculateTotalPrice(
                roomType.getBasePrice(),
                request.getStartDate(),
                request.getEndDate(),
                roomType.getId()
        );

        booking.setTotalPrice(totalPrice);

        Booking saved = bookingRepository.save(booking);
        return bookingMapper.toResponse(saved);
    }

    @Transactional(readOnly = true)
    public BookingResponse getBookingById(Long id) {
        Booking booking = getBookingEntityById(id);
        ensureCanAccessBooking(booking);
        return bookingMapper.toResponse(booking);
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getAllBookings() {
        AppUser currentUser = currentUserProvider.getCurrentUser();

        if (isAdmin(currentUser)) {
            return bookingRepository.findAll()
                    .stream()
                    .map(bookingMapper::toResponse)
                    .toList();
        }

        if (isManager(currentUser)) {
            List<Long> managedHotelIds = hotelRepository.findByManagerId(currentUser.getId())
                    .stream()
                    .map(Hotel::getId)
                    .toList();

            if (managedHotelIds.isEmpty()) {
                return List.of();
            }

            return bookingRepository.findByHotelIdIn(managedHotelIds)
                    .stream()
                    .map(bookingMapper::toResponse)
                    .toList();
        }

        return bookingRepository.findByGuestId(currentUser.getId())
                .stream()
                .map(bookingMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getMyBookings() {
        AppUser currentUser = currentUserProvider.getCurrentUser();
        return bookingRepository.findByGuestId(currentUser.getId())
                .stream()
                .map(bookingMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getBookingsByStatus(BookingStatus status) {
        AppUser currentUser = currentUserProvider.getCurrentUser();

        if (isAdmin(currentUser)) {
            return bookingRepository.findByStatus(status)
                    .stream()
                    .map(bookingMapper::toResponse)
                    .toList();
        }

        if (isManager(currentUser)) {
            List<Long> managedHotelIds = hotelRepository.findByManagerId(currentUser.getId())
                    .stream()
                    .map(Hotel::getId)
                    .toList();

            if (managedHotelIds.isEmpty()) {
                return List.of();
            }

            return bookingRepository.findByHotelIdInAndStatus(managedHotelIds, status)
                    .stream()
                    .map(bookingMapper::toResponse)
                    .toList();
        }

        return bookingRepository.findByGuestId(currentUser.getId())
                .stream()
                .filter(booking -> booking.getStatus() == status)
                .map(bookingMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getUpcomingBookings(Long hotelId) {
        AppUser currentUser = currentUserProvider.getCurrentUser();
        LocalDate today = LocalDate.now();

        if (hotelId != null) {
            Hotel hotel = hotelRepository.findById(hotelId)
                    .orElseThrow(() -> new ResourceNotFoundException("Hotel", hotelId));
            ensureCanAccessHotel(hotel);

            return bookingRepository.findByHotelIdAndStartDateGreaterThanEqualAndStatusNotOrderByStartDateAsc(
                            hotelId,
                            today,
                            BookingStatus.CANCELLED
                    ).stream()
                    .map(bookingMapper::toResponse)
                    .toList();
        }

        if (isAdmin(currentUser)) {
            return bookingRepository.findByStartDateGreaterThanEqualAndStatusNotOrderByStartDateAsc(
                            today,
                            BookingStatus.CANCELLED
                    ).stream()
                    .map(bookingMapper::toResponse)
                    .toList();
        }

        if (isManager(currentUser)) {
            List<Long> managedHotelIds = hotelRepository.findByManagerId(currentUser.getId())
                    .stream()
                    .map(Hotel::getId)
                    .toList();

            if (managedHotelIds.isEmpty()) {
                return List.of();
            }


            return bookingRepository
                    .findByHotelIdInAndStartDateGreaterThanEqualOrderByStartDateAsc(managedHotelIds, today)
                    .stream()
                    .filter(b -> b.getStatus() != BookingStatus.CANCELLED)
                    .map(bookingMapper::toResponse)
                    .toList();
        }

        return bookingRepository.findByGuestId(currentUser.getId())
                .stream()
                .filter(booking -> booking.getStatus() != BookingStatus.CANCELLED)
                .filter(booking -> !booking.getStartDate().isBefore(today))
                .map(bookingMapper::toResponse)
                .toList();
    }

    public BookingResponse confirmBooking(Long id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("booking", id));

        ensureCanManageBooking(booking);

        if (booking.getStatus() == BookingStatus.CONFIRMED) {
            throw new BusinessException("Booking is already confirmed.");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new BusinessException("Cannot confirm a cancelled booking.");
        }

        RoomType roomType = roomTypeRepository.findByIdForUpdate(booking.getRoomTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("roomType", booking.getRoomTypeId()));

        validateAvailabilityExcludingCurrent(
                roomType,
                booking.getStartDate(),
                booking.getEndDate(),
                booking.getId()
        );

        booking.setStatus(BookingStatus.CONFIRMED);

        Booking savedBooking = bookingRepository.save(booking);
        return bookingMapper.toResponse(savedBooking);
    }

    public BookingResponse cancelBooking(Long id) {
        Booking booking = getBookingEntityById(id);
        ensureCanCancelBooking(booking);

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new BusinessException("Booking is already cancelled.");
        }

        Long roomTypeId = booking.getRoomTypeId();
        booking.setStatus(BookingStatus.CANCELLED);
        Booking saved = bookingRepository.save(booking);
        alertService.checkAlertsForRoomType(roomTypeId);
        return bookingMapper.toResponse(saved);
    }

    public void deleteBooking(Long id) {
        Booking booking = getBookingEntityById(id);
        ensureCanManageBooking(booking);

        if (booking.getStatus() == BookingStatus.CONFIRMED) {
            throw new BusinessException("Confirmed booking cannot be deleted. Please cancel it first.");
        }

        Long roomTypeId = booking.getRoomTypeId();
        bookingRepository.delete(booking);
        alertService.checkAlertsForRoomType(roomTypeId);
    }

    @Transactional(readOnly = true)
    public boolean isRoomAvailable(Long roomTypeId, LocalDate startDate, LocalDate endDate) {
        return checkAvailability(roomTypeId, startDate, endDate).available();
    }

    @Transactional(readOnly = true)
    public AvailabilityCheckResponse checkAvailability(Long roomTypeId, LocalDate startDate, LocalDate endDate) {
        validateDateRange(startDate, endDate);

        RoomType roomType = roomTypeRepository.findById(roomTypeId)
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", roomTypeId));

        long overlappingBookings = bookingRepository.countActiveOverlappingBookings(
                roomTypeId, startDate, endDate
        );

        return availabilityPricingService.checkAvailability(
                roomType.getBasePrice(),
                roomType.getCapacity(),
                roomType.getInventoryCount(),
                startDate,
                endDate,
                roomType.getCapacity(),
                overlappingBookings,
                roomTypeId
        );
    }

    private Booking getBookingEntityById(Long id) {
        return bookingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Booking", id));
    }

    private void validateBookingRequest(BookingRequest request) {
        if (request.getHotelId() == null) {
            throw new BusinessException("Hotel ID is required.");
        }
        if (request.getRoomTypeId() == null) {
            throw new BusinessException("Room type ID is required.");
        }
        validateDateRange(request.getStartDate(), request.getEndDate());
    }

    private void validateDateRange(LocalDate startDate, LocalDate endDate) {
        if (startDate == null || endDate == null) {
            throw new BusinessException("Start and end dates are required.");
        }
        if (!endDate.isAfter(startDate)) {
            throw new BusinessException("End date must be after start date");
        }
        if (startDate.isBefore(LocalDate.now())) {
            throw new BusinessException("Start date cannot be in the past");
        }
    }

    private void validateHotelRoomMatch(Long hotelId, RoomType roomType) {
        if (!roomType.getHotel().getId().equals(hotelId)) {
            throw new BusinessException("Selected room type does not belong to this hotel.");
        }
    }

    private void validateAvailability(RoomType roomType, LocalDate startDate, LocalDate endDate) {
        long overlappingBookings = bookingRepository.countActiveOverlappingBookings(
                roomType.getId(), startDate, endDate
        );

        if (overlappingBookings >= roomType.getInventoryCount()) {
            throw new BusinessException("No rooms are available for the selected dates.");
        }
    }

    private void ensureCanAccessBooking(Booking booking) {
        AppUser currentUser = currentUserProvider.getCurrentUser();

        if (isAdmin(currentUser)) return;
        if (booking.getGuestId().equals(currentUser.getId())) return;
        if (isManager(currentUser) && managesHotel(currentUser.getId(), booking.getHotelId())) return;

        throw new org.springframework.security.access.AccessDeniedException(
                "You are not allowed to access this booking.");
    }

    private void ensureCanManageBooking(Booking booking) {
        AppUser currentUser = currentUserProvider.getCurrentUser();

        if (isAdmin(currentUser)) return;
        if (isManager(currentUser) && managesHotel(currentUser.getId(), booking.getHotelId())) return;

        throw new org.springframework.security.access.AccessDeniedException(
                "You are not allowed to manage this booking.");
    }

    private void ensureCanCancelBooking(Booking booking) {
        AppUser currentUser = currentUserProvider.getCurrentUser();

        if (isAdmin(currentUser)) return;
        if (booking.getGuestId().equals(currentUser.getId())) return;
        if (isManager(currentUser) && managesHotel(currentUser.getId(), booking.getHotelId())) return;

        throw new org.springframework.security.access.AccessDeniedException(
                "You are not allowed to cancel this booking.");
    }

    private void ensureCanAccessHotel(Hotel hotel) {
        AppUser currentUser = currentUserProvider.getCurrentUser();

        if (isAdmin(currentUser)) return;
        if (isManager(currentUser)
                && hotel.getManagerId() != null
                && hotel.getManagerId().equals(currentUser.getId())) return;

        throw new org.springframework.security.access.AccessDeniedException(
                "You are not allowed to access this hotel's bookings.");
    }

    private boolean managesHotel(Long managerId, Long hotelId) {
        return hotelRepository.findById(hotelId)
                .map(hotel -> hotel.getManagerId() != null && hotel.getManagerId().equals(managerId))
                .orElse(false);
    }

    private boolean isAdmin(AppUser user) {
        return roleManagementService.userHasRole(user, "ADMIN");
    }

    private boolean isManager(AppUser user) {
        return roleManagementService.userHasRole(user, "MANAGER");
    }

    private void validateAvailabilityExcludingCurrent(RoomType roomType,
                                                      LocalDate startDate,
                                                      LocalDate endDate,
                                                      Long bookingId) {
        long overlappingBookings = bookingRepository.countActiveOverlappingBookingsExcluding(
                roomType.getId(), startDate, endDate, bookingId
        );

        if (overlappingBookings >= roomType.getInventoryCount()) {
            throw new BusinessException("No rooms are available for the selected dates.");
        }
    }
}