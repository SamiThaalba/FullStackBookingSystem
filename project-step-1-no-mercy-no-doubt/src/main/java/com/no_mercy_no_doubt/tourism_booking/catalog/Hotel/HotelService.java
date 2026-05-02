package com.no_mercy_no_doubt.tourism_booking.catalog.Hotel;

import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.auth.repository.AppUserRepository;
import com.no_mercy_no_doubt.tourism_booking.auth.service.RoleManagementService;
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

import java.util.List;

@Service
@RequiredArgsConstructor
public class HotelService {

    private final HotelRepository hotelRepository;
    private final CatalogMapper mapper;
    private final AppUserRepository userRepository;
    private final RoleManagementService roleManagementService;
    private final CurrentUserProvider currentUserProvider;

    @Transactional
    public HotelResponse createHotel(HotelRequest request) {
        AppUser currentUser = currentUserProvider.getCurrentUser();

        if (roleManagementService.userHasRole(currentUser, "MANAGER")) {
            request.setManagerId(currentUser.getId());
        }

        validateManager(request.getManagerId());

        Hotel hotel = mapper.toEntity(request);
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

    public HotelResponse getHotelById(Long id) {
        Hotel hotel = hotelRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Hotel", id));
        return mapper.toHotelResponse(hotel, true);
    }

    public PageResponse<HotelResponse> listHotelsWithFilters(String city, String country, String name,
                                                             int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Hotel> result = hotelRepository.findByFilters(city, country, name, pageable);

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

    @Transactional(readOnly = true)
    public List<HotelResponse> getMyHotels() {
        AppUser currentUser = currentUserProvider.getCurrentUser();
        return hotelRepository.findByManagerId(currentUser.getId())
                .stream()
                .map(h -> mapper.toHotelResponse(h, false))
                .toList();
    }

    @Transactional
    public HotelResponse patchHotel(Long id, HotelPatchRequest request) {
        Hotel hotel = hotelRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Hotel", id));

        ensureCanManageHotel(hotel);

        if (request.name() != null) hotel.setName(request.name().trim());
        if (request.description() != null) hotel.setDescription(request.description());
        if (request.imageUrl() != null) hotel.setImageUrl(request.imageUrl().trim());
        if (request.address() != null) hotel.setAddress(request.address().trim());
        if (request.city() != null) hotel.setCity(request.city().trim());
        if (request.country() != null) hotel.setCountry(request.country().trim());
        if (request.phone() != null) hotel.setPhone(request.phone().trim());
        if (request.email() != null) hotel.setEmail(request.email().trim());

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

        if (roleManagementService.userHasRole(currentUser, "ADMIN")) return;

        if (roleManagementService.userHasRole(currentUser, "MANAGER")
                && hotel.getManagerId() != null
                && hotel.getManagerId().equals(currentUser.getId())) return;

        throw new AccessDeniedException("You are not allowed to manage this hotel.");
    }

    private void ensureManagerAssignmentAllowed(Hotel existingHotel, Long requestedManagerId) {
        if (requestedManagerId == null) return;

        AppUser currentUser = currentUserProvider.getCurrentUser();

        if (roleManagementService.userHasRole(currentUser, "ADMIN")) return;

        if (roleManagementService.userHasRole(currentUser, "MANAGER")) {
            Long myId = currentUser.getId();

            if (!requestedManagerId.equals(myId)) {
                throw new AccessDeniedException("Managers can only assign themselves as manager.");
            }

            Long currentManagerId = existingHotel.getManagerId();
            if (currentManagerId != null && !currentManagerId.equals(myId)) {
                throw new AccessDeniedException("Managers cannot change the manager of a hotel.");
            }
        }
    }
}