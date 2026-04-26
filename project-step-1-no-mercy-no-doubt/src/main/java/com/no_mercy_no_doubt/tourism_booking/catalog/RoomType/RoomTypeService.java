package com.no_mercy_no_doubt.tourism_booking.catalog.RoomType;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.Hotel;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.CatalogMapper;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.HotelRepository;
import com.no_mercy_no_doubt.tourism_booking.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomTypeService {
    private final HotelRepository hotelRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final CatalogMapper mapper;
    @Transactional
    public RoomTypeResponse createRoomType(RoomTypeRequest request) {
        Hotel hotel = hotelRepository.findById(request.getHotelId())
                .orElseThrow(() -> new ResourceNotFoundException("Hotel", request.getHotelId()));
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
        mapper.updateRoomType(roomType, request);
        roomType = roomTypeRepository.save(roomType);
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
        return hotel.getRoomTypes().stream().map(a->mapper.toRoomTypeResponse(a)).toList();
    }

    public List<RoomTypeResponse> getRoomTypesByHotel(Long hotelId) {
        return roomTypeRepository.findByHotelId(hotelId).stream()
                .map(mapper::toRoomTypeResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteRoomType( Long roomTypeId) {
        RoomType roomType = roomTypeRepository.findById(roomTypeId)
                .orElseThrow(() -> new ResourceNotFoundException("RoomType", roomTypeId));

        roomTypeRepository.deleteById(roomTypeId);
    }
}
