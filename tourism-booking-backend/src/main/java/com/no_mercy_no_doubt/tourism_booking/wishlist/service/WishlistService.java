package com.no_mercy_no_doubt.tourism_booking.wishlist.service;

import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.Hotel;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.HotelRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomType;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeRepository;
import com.no_mercy_no_doubt.tourism_booking.common.exception.ResourceNotFoundException;
import com.no_mercy_no_doubt.tourism_booking.common.utils.CurrentUserProvider;
import com.no_mercy_no_doubt.tourism_booking.wishlist.dto.CreateWishlistRequest;
import com.no_mercy_no_doubt.tourism_booking.wishlist.dto.WishlistResponse;
import com.no_mercy_no_doubt.tourism_booking.wishlist.entity.WishlistItem;
import com.no_mercy_no_doubt.tourism_booking.wishlist.enums.WishlistItemType;
import com.no_mercy_no_doubt.tourism_booking.wishlist.repository.WishlistItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class WishlistService {

    private final WishlistItemRepository wishlistItemRepository;
    private final CurrentUserProvider currentUserProvider;
    private final HotelRepository hotelRepository;
    private final RoomTypeRepository roomTypeRepository;

    public WishlistResponse add(CreateWishlistRequest request) {
        AppUser user = currentUserProvider.getCurrentUser();
        validateTargetExists(request.itemType(), request.targetId());

        boolean exists = wishlistItemRepository.existsByUserIdAndItemTypeAndTargetId(
                user.getId(),
                request.itemType(),
                request.targetId()
        );

        if (exists) {
            throw new IllegalArgumentException("This item is already in your wishlist.");
        }

        WishlistItem item = WishlistItem.builder()
                .user(user)
                .itemType(request.itemType())
                .targetId(request.targetId())
                .note(request.note())
                .createdAt(LocalDateTime.now())
                .build();

        wishlistItemRepository.save(item);
        return toResponse(item);
    }

    @Transactional(readOnly = true)
    public List<WishlistResponse> myWishlist() {
        AppUser user = currentUserProvider.getCurrentUser();

        return wishlistItemRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public void remove(WishlistItemType itemType, Long targetId) {
        AppUser user = currentUserProvider.getCurrentUser();

        WishlistItem item = wishlistItemRepository.findByUserIdAndItemTypeAndTargetId(user.getId(), itemType, targetId)
                .orElseThrow(() -> new ResourceNotFoundException("WishlistItem", targetId));

        wishlistItemRepository.delete(item);
    }

    private void validateTargetExists(WishlistItemType itemType, Long targetId) {
        switch (itemType) {
            case HOTEL -> hotelRepository.findById(targetId)
                    .orElseThrow(() -> new ResourceNotFoundException("Hotel", targetId));
            case ROOM_TYPE -> roomTypeRepository.findById(targetId)
                    .orElseThrow(() -> new ResourceNotFoundException("RoomType", targetId));
        }
    }

    private WishlistResponse toResponse(WishlistItem item) {
        return switch (item.getItemType()) {
            case HOTEL -> mapHotelItem(item);
            case ROOM_TYPE -> mapRoomTypeItem(item);
        };
    }

    private WishlistResponse mapHotelItem(WishlistItem item) {
        Hotel hotel = hotelRepository.findById(item.getTargetId())
                .orElseThrow(() -> new ResourceNotFoundException("Hotel", item.getTargetId()));

        String subtitle = buildHotelSubtitle(hotel);

        return new WishlistResponse(
                item.getId(),
                item.getItemType(),
                item.getTargetId(),
                hotel.getName(),
                hotel.getImageUrl(),
                subtitle,
                item.getNote(),
                item.getCreatedAt()
        );
    }

    private WishlistResponse mapRoomTypeItem(WishlistItem item) {
        RoomType roomType = roomTypeRepository.findById(item.getTargetId())
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", item.getTargetId()));

        String hotelName = roomType.getHotel() != null ? roomType.getHotel().getName() : null;
        String subtitle = buildRoomTypeSubtitle(roomType, hotelName);

        return new WishlistResponse(
                item.getId(),
                item.getItemType(),
                item.getTargetId(),
                roomType.getName(),
                roomType.getHotel() != null ? roomType.getHotel().getImageUrl() : null,
                subtitle,
                item.getNote(),
                item.getCreatedAt()
        );
    }

    private String buildHotelSubtitle(Hotel hotel) {
        String city = hotel.getDisplayCity() != null ? hotel.getDisplayCity() : "";
        String country = hotel.getDisplayCountry() != null ? hotel.getDisplayCountry() : "";

        if (!city.isBlank() && !country.isBlank()) {
            return city + ", " + country;
        }
        if (!city.isBlank()) {
            return city;
        }
        return country;
    }

    private String buildRoomTypeSubtitle(RoomType roomType, String hotelName) {
        String pricePart = roomType.getBasePrice() != null
                ? "Price: " + roomType.getBasePrice().stripTrailingZeros().toPlainString()
                : "Price: N/A";

        String capacityPart = "Capacity: " + roomType.getCapacity();

        if (hotelName != null && !hotelName.isBlank()) {
            return hotelName + " | " + pricePart + " | " + capacityPart;
        }

        return pricePart + " | " + capacityPart;
    }
}