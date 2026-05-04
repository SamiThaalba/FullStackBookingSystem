package com.no_mercy_no_doubt.tourism_booking.catalog.Hotel;

import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.auth.repository.AppUserRepository;
import com.no_mercy_no_doubt.tourism_booking.auth.service.RoleManagementService;
import com.no_mercy_no_doubt.tourism_booking.catalog.Booking.BookingRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.geography.City;
import com.no_mercy_no_doubt.tourism_booking.catalog.geography.CityRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomType;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeRepository;
import com.no_mercy_no_doubt.tourism_booking.common.dto.PageResponse;
import com.no_mercy_no_doubt.tourism_booking.common.exception.BusinessException;
import com.no_mercy_no_doubt.tourism_booking.common.exception.ResourceNotFoundException;
import com.no_mercy_no_doubt.tourism_booking.common.utils.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class HotelService {

    private final HotelRepository hotelRepository;
    private final CityRepository cityRepository;
    private final CatalogMapper mapper;
    private final AppUserRepository userRepository;
    private final RoleManagementService roleManagementService;
    private final CurrentUserProvider currentUserProvider;
    private final RoomTypeRepository roomTypeRepository;
    private final BookingRepository bookingRepository;

    @Transactional
    public HotelResponse createHotel(HotelRequest request) {
        AppUser currentUser = currentUserProvider.getCurrentUser();

        if (request.getManagerId() == null
                && !roleManagementService.canBypassHotelScope(currentUser)) {
            request.setManagerId(currentUser.getId());
        }

        validateManager(request.getManagerId());

        Hotel hotel = mapper.toEntity(request);
        hotel.setOwnerId(currentUser.getId());
        hotel = hotelRepository.save(hotel);
        return mapper.toHotelResponse(hotel, false);
    }

    @Transactional
    public HotelResponse updateHotel(Long id, HotelRequest request) {
        Hotel hotel = hotelRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Hotel", id));

        ensureCanManageHotel(hotel);
        ensureManagerAssignmentAllowed(hotel, request.getManagerId());
        validateManager(request.getManagerId());

        mapper.updateHotel(hotel, request);
        hotel = hotelRepository.save(hotel);
        return mapper.toHotelResponse(hotel, false);
    }

    @Transactional(readOnly = true)
    public HotelResponse getHotelById(Long id) {
        Hotel hotel = hotelRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Hotel", id));
        return mapper.toHotelResponse(hotel, true);
    }

    @Transactional(readOnly = true)
    public PageResponse<HotelResponse> listHotelsWithFilters(String city, String country, String name,
                                                             Integer guests, Integer adults, Integer children,
                                                             LocalDate from, LocalDate to,
                                                             int page, int size) {
        Integer effectiveGuests = resolveGuests(guests, adults, children);
        validateDateRange(from, to);

        if (effectiveGuests == null && from == null && to == null) {
            return listHotelsBasic(city, country, name, page, size);
        }

        String cityParam = blankToNull(city);
        String countryParam = blankToNull(country);
        String nameParam = blankToNull(name);
        String cityPattern = cityParam == null ? null : "%" + cityParam + "%";
        String countryPattern = countryParam == null ? null : "%" + countryParam + "%";
        String namePattern = nameParam == null ? null : "%" + nameParam + "%";

        // We must filter by room availability/capacity in memory for now.
        List<Hotel> candidates = hotelRepository.findByFilters(
                cityPattern, countryPattern, namePattern, PageRequest.of(0, 2000)
        ).getContent();

        List<Hotel> filtered = candidates.stream()
                .filter(hotel -> matchesGuestAndAvailability(hotel.getId(), effectiveGuests, from, to))
                .toList();

        int total = filtered.size();
        int fromIndex = Math.min(page * size, total);
        int toIndex = Math.min(fromIndex + size, total);
        List<HotelResponse> content = filtered.subList(fromIndex, toIndex).stream()
                .map(h -> mapper.toHotelResponse(h, false))
                .toList();

        int totalPages = size == 0 ? 1 : (int) Math.ceil(total / (double) size);

        return PageResponse.<HotelResponse>builder()
                .content(content)
                .page(page)
                .size(size)
                .totalElements(total)
                .totalPages(totalPages)
                .first(page == 0)
                .last(page >= Math.max(0, totalPages - 1))
                .build();
    }

    private PageResponse<HotelResponse> listHotelsBasic(String city, String country, String name, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        String cityParam = blankToNull(city);
        String countryParam = blankToNull(country);
        String nameParam = blankToNull(name);
        String cityPattern = cityParam == null ? null : "%" + cityParam + "%";
        String countryPattern = countryParam == null ? null : "%" + countryParam + "%";
        String namePattern = nameParam == null ? null : "%" + nameParam + "%";
        Page<Hotel> result = hotelRepository.findByFilters(cityPattern, countryPattern, namePattern, pageable);

        List<HotelResponse> content = result.getContent().stream()
                .map(h -> mapper.toHotelResponse(h, false))
                .toList();

        return PageResponse.<HotelResponse>builder()
                .content(content)
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .first(result.isFirst())
                .last(result.isLast())
                .build();
    }

    private boolean matchesGuestAndAvailability(Long hotelId, Integer guests, LocalDate from, LocalDate to) {
        List<RoomType> roomTypes = roomTypeRepository.findByHotelId(hotelId);
        for (RoomType room : roomTypes) {
            if (guests != null && room.getCapacity() < guests) {
                continue;
            }
            if (from != null && to != null) {
                long overlapping = bookingRepository.countActiveOverlappingBookings(room.getId(), from, to);
                if (overlapping >= room.getInventoryCount()) {
                    continue;
                }
            }
            return true;
        }
        return false;
    }

    private Integer resolveGuests(Integer guests, Integer adults, Integer children) {
        if (guests != null && guests > 0) {
            return guests;
        }
        int adultCount = adults != null ? Math.max(0, adults) : 0;
        int childrenCount = children != null ? Math.max(0, children) : 0;
        int total = adultCount + childrenCount;
        return total > 0 ? total : null;
    }

    private void validateDateRange(LocalDate from, LocalDate to) {
        if ((from == null && to != null) || (from != null && to == null)) {
            throw new BusinessException("Both check-in and check-out dates are required when filtering by date.");
        }
        if (from != null && to != null && !to.isAfter(from)) {
            throw new BusinessException("Check-out date must be after check-in date.");
        }
    }

    @Transactional(readOnly = true)
    public List<HotelResponse> getMyHotels() {
        AppUser currentUser = currentUserProvider.getCurrentUser();
        if (roleManagementService.canBypassHotelScope(currentUser)) {
            return hotelRepository.findAll().stream()
                    .map(h -> mapper.toHotelResponse(h, false))
                    .toList();
        }
        return hotelRepository.findByOwnerIdOrManagerId(currentUser.getId())
                .stream()
                .map(h -> mapper.toHotelResponse(h, false))
                .toList();
    }

    @Transactional
    public HotelResponse patchHotel(Long id, HotelPatchRequest request) {
        Hotel hotel = hotelRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Hotel", id));

        ensureCanManageHotel(hotel);

        if (request.name() != null) {
            hotel.setName(request.name().trim());
        }
        if (request.description() != null) {
            hotel.setDescription(request.description());
        }
        if (request.imageUrl() != null) {
            hotel.setImageUrl(request.imageUrl().trim());
        }
        if (request.address() != null) {
            hotel.setAddress(request.address().trim());
        }
        if (request.cityId() != null) {
            City city = cityRepository.findById(request.cityId())
                    .orElseThrow(() -> new ResourceNotFoundException("City", request.cityId()));
            hotel.setLocatedCity(city);
        }
        if (request.latitude() != null) {
            hotel.setLatitude(request.latitude());
        }
        if (request.longitude() != null) {
            hotel.setLongitude(request.longitude());
        }
        if (request.phone() != null) {
            hotel.setPhone(request.phone().trim());
        }
        if (request.email() != null) {
            hotel.setEmail(request.email().trim());
        }
        if (request.managerId() != null) {
            validateManager(request.managerId());
            ensureManagerAssignmentAllowed(hotel, request.managerId());
            hotel.setManagerId(request.managerId());
        }

        hotel = hotelRepository.save(hotel);
        return mapper.toHotelResponse(hotel, false);
    }

    @Transactional
    public void deleteHotel(Long id) {
        Hotel hotel = hotelRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Hotel", id));

        ensureCanManageHotel(hotel);
        hotelRepository.delete(hotel);
    }

    private void validateManager(Long managerId) {
        if (managerId == null) return;

        if (managerId <= 0) {
            throw new BusinessException("Manager ID must be greater than zero.");
        }

        AppUser user = userRepository.findById(managerId)
                .orElseThrow(() -> new ResourceNotFoundException("User", managerId));

        if (!roleManagementService.userHasRole(user, "MANAGER")) {
            throw new BusinessException("Selected user is not a manager.");
        }
    }

    private void ensureCanManageHotel(Hotel hotel) {
        AppUser currentUser = currentUserProvider.getCurrentUser();

        if (roleManagementService.canBypassHotelScope(currentUser)) {
            return;
        }
        if (hotel.getOwnerId() != null && hotel.getOwnerId().equals(currentUser.getId())) {
            return;
        }
        if (hotel.getManagerId() != null && hotel.getManagerId().equals(currentUser.getId())) {
            return;
        }

        throw new AccessDeniedException("You are not allowed to manage this hotel.");
    }

    private void ensureManagerAssignmentAllowed(Hotel existingHotel, Long requestedManagerId) {
        if (requestedManagerId == null) return;

        AppUser currentUser = currentUserProvider.getCurrentUser();

        if (roleManagementService.canBypassHotelScope(currentUser)) {
            return;
        }

        Long myId = currentUser.getId();
        boolean isOwner = existingHotel.getOwnerId() != null && existingHotel.getOwnerId().equals(myId);
        if (isOwner) {
            return;
        }

        if (!requestedManagerId.equals(myId)) {
            throw new AccessDeniedException("You can only assign yourself as manager for this hotel.");
        }

        Long currentManagerId = existingHotel.getManagerId();
        if (currentManagerId != null && !currentManagerId.equals(myId)) {
            throw new AccessDeniedException("You cannot change the manager of a hotel you do not own.");
        }
    }

    private static String blankToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}