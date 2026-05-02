package com.no_mercy_no_doubt.tourism_booking.catalog.Hotel;

import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomType;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeRequest;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeResponse;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.stream.Collectors;

@Component
public class CatalogMapper {

    public Hotel toEntity(HotelRequest req) {
        return Hotel.builder()
                .name(req.getName())
                .description(req.getDescription())
                .imageUrl(req.getImageUrl())
                .address(req.getAddress())
                .city(req.getCity())
                .country(req.getCountry())
                .latitude(req.getLatitude())
                .longitude(req.getLongitude())
                .phone(req.getPhone())
                .email(req.getEmail())
                .managerId(req.getManagerId())
                .build();
    }

    public void updateHotel(Hotel entity, HotelRequest req) {
        entity.setName(req.getName());
        entity.setDescription(req.getDescription());
        entity.setImageUrl(req.getImageUrl());
        entity.setAddress(req.getAddress());
        entity.setCity(req.getCity());
        entity.setCountry(req.getCountry());
        entity.setLatitude(req.getLatitude());
        entity.setLongitude(req.getLongitude());
        entity.setPhone(req.getPhone());
        entity.setEmail(req.getEmail());
        entity.setManagerId(req.getManagerId());
    }

    public HotelResponse toHotelResponse(Hotel hotel, boolean includeRoomTypes) {
        HotelResponse.HotelResponseBuilder b = HotelResponse.builder()
                .id(hotel.getId())
                .name(hotel.getName())
                .description(hotel.getDescription())
                .imageUrl(hotel.getImageUrl())
                .address(hotel.getAddress())
                .city(hotel.getCity())
                .country(hotel.getCountry())
                .phone(hotel.getPhone())
                .email(hotel.getEmail())
                .managerId(hotel.getManagerId())
                .latitude(hotel.getLatitude())
                .longitude(hotel.getLongitude());

        if (includeRoomTypes && hotel.getRoomTypes() != null) {
            b.roomTypes(hotel.getRoomTypes()
                    .stream()
                    .map(this::toRoomTypeResponse)
                    .collect(Collectors.toList()));
        } else {
            b.roomTypes(Collections.emptyList());
        }

        return b.build();
    }

    public RoomType toEntity(RoomTypeRequest req, Hotel hotel) {
        return RoomType.builder()
                .name(req.getName())
                .description(req.getDescription())
                .capacity(req.getCapacity())
                .inventoryCount(req.getInventoryCount() != null ? req.getInventoryCount() : 1)
                .basePrice(req.getBasePrice())
                .amenities(req.getAmenities() != null ? req.getAmenities() : Collections.emptyList())
                .hotel(hotel)
                .build();
    }

    public void updateRoomType(RoomType entity, RoomTypeRequest req) {
        entity.setName(req.getName());
        entity.setDescription(req.getDescription());
        entity.setCapacity(req.getCapacity());
        entity.setInventoryCount(req.getInventoryCount() != null ? req.getInventoryCount() : 1);
        entity.setBasePrice(req.getBasePrice());
        entity.setAmenities(req.getAmenities() != null ? req.getAmenities() : Collections.emptyList());
    }

    public RoomTypeResponse toRoomTypeResponse(RoomType rt) {
        return RoomTypeResponse.builder()
                .id(rt.getId())
                .name(rt.getName())
                .description(rt.getDescription())
                .capacity(rt.getCapacity())
                .inventoryCount(rt.getInventoryCount())
                .basePrice(rt.getBasePrice())
                .amenities(rt.getAmenities())
                .hotelId(rt.getHotel() != null ? rt.getHotel().getId() : null)
                .build();
    }
}