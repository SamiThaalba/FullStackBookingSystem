package com.no_mercy_no_doubt.tourism_booking.catalog.RoomType;

import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.auth.service.RoleManagementService;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.CatalogMapper;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.Hotel;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.HotelRepository;
import com.no_mercy_no_doubt.tourism_booking.common.exception.ResourceNotFoundException;
import com.no_mercy_no_doubt.tourism_booking.common.utils.CurrentUserProvider;
import com.no_mercy_no_doubt.tourism_booking.wishlist.repository.PriceAvailabilityAlertRepository;
import com.no_mercy_no_doubt.tourism_booking.wishlist.service.RoomTypeAlertAsyncTrigger;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomTypeService {

    private final HotelRepository hotelRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final CatalogMapper mapper;
    private final CurrentUserProvider currentUserProvider;
    private final RoleManagementService roleManagementService;
    // FIX: inject so we can delete orphan alerts before deleting a room type
    private final PriceAvailabilityAlertRepository alertRepository;
    private final RoomTypeAlertAsyncTrigger roomTypeAlertAsyncTrigger;

    @Transactional
    public RoomTypeResponse createRoomType(RoomTypeRequest request) {
        Hotel hotel = hotelRepository.findById(request.getHotelId())
                .orElseThrow(() -> new ResourceNotFoundException("Hotel", request.getHotelId()));

        // FIX: only the hotel's manager (or admin) may add rooms
        ensureCanManageHotel(hotel);

        RoomType roomType = mapper.toEntity(request, hotel);
        roomType = roomTypeRepository.save(roomType);
        return mapper.toRoomTypeResponse(roomType);
    }

    @Transactional
    public RoomTypeResponse updateRoomType(Long roomTypeId, RoomTypeRequest request) {
        RoomType roomType = roomTypeRepository.findById(roomTypeId)
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", roomTypeId));

        if (!roomType.getHotel().getId().equals(request.getHotelId())) {
            throw new ResourceNotFoundException("RoomType", roomTypeId);
        }

        // FIX: only the hotel's manager (or admin) may update rooms
        ensureCanManageHotel(roomType.getHotel());

        mapper.updateRoomType(roomType, request);
        roomType = roomTypeRepository.save(roomType);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    roomTypeAlertAsyncTrigger.checkAfterRoomUpdate(roomTypeId);
                }
            });
        } else {
            roomTypeAlertAsyncTrigger.checkAfterRoomUpdate(roomTypeId);
        }
        return mapper.toRoomTypeResponse(roomType);
    }

    public RoomTypeResponse getRoomTypeById(Long roomTypeId) {
        RoomType roomType = roomTypeRepository.findById(roomTypeId)
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", roomTypeId));
        return mapper.toRoomTypeResponse(roomType);
    }

    public List<RoomTypeResponse> getAllRoomTypes(Long hotelId) {
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ResourceNotFoundException("Hotel", hotelId));
        return hotel.getRoomTypes().stream()
                .map(mapper::toRoomTypeResponse)
                .toList();
    }

    public List<RoomTypeResponse> getRoomTypesByHotel(Long hotelId) {
        return roomTypeRepository.findByHotelId(hotelId).stream()
                .map(mapper::toRoomTypeResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteRoomType(Long roomTypeId) {
        RoomType roomType = roomTypeRepository.findById(roomTypeId)
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", roomTypeId));

        // FIX: only the hotel's manager (or admin) may delete rooms
        ensureCanManageHotel(roomType.getHotel());

        // FIX: delete all price/availability alerts referencing this room type first,
        // otherwise the FK constraint on price_availability_alerts(room_type_id) will
        // prevent the delete with a DataIntegrityViolationException.
        List<Long> alertIds = alertRepository
                .findByRoomTypeIdAndActiveTrueWithAssociations(roomTypeId)
                .stream()
                .map(a -> a.getId())
                .collect(Collectors.toList());

        if (!alertIds.isEmpty()) {
            alertRepository.deleteAllById(alertIds);
        }

        // Also delete ALL alerts for this room (active and inactive) to be safe
        alertRepository.deleteByRoomTypeId(roomTypeId);

        roomTypeRepository.deleteById(roomTypeId);
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

        throw new AccessDeniedException("You are not allowed to manage rooms for this hotel.");
    }
}