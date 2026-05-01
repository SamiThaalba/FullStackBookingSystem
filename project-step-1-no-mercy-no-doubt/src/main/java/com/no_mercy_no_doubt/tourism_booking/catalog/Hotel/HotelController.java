package com.no_mercy_no_doubt.tourism_booking.catalog.Hotel;

import com.no_mercy_no_doubt.tourism_booking.common.dto.PageResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/hotels")
public class HotelController {
    private HotelService service;

    public HotelController(HotelService hotelService) {
        this.service = hotelService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('hotel:create')")
    public ResponseEntity<HotelResponse> CreateHotel(@RequestBody @Valid HotelRequest value) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createHotel(value));
    }

    @GetMapping("/{id}")
    public ResponseEntity<HotelResponse> GetHotel(@PathVariable long id) {
        return ResponseEntity.ok(service.getHotelById(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('hotel:update')")
    public ResponseEntity<HotelResponse> UpdateHotel(@PathVariable long id, @Valid @RequestBody HotelRequest request) {
        return ResponseEntity.ok(service.updateHotel(id, request));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAuthority('hotel:update')")
    public ResponseEntity<HotelResponse> PartialUpdateHotel(@PathVariable long id, @Valid @RequestBody HotelPatchRequest request) {
        return ResponseEntity.ok(service.patchHotel(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('hotel:delete')")
    public ResponseEntity<Void> DeleteHotel(@PathVariable long id) {
        service.deleteHotel(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<PageResponse<HotelResponse>> getHotels(@RequestParam(required = false) Integer page,
                                                                 @RequestParam(required = false) Integer size,
                                                                 @RequestParam(required = false) String name,
                                                                 @RequestParam(required = false) String city,
                                                                 @RequestParam(required = false) String country) {
        int pageNum = (page != null && page >= 0) ? page : 0;
        int pageSize = (size != null && size > 0) ? size : 10;
        return ResponseEntity.ok(service.listHotelsWithFilters(city, country, name, pageNum, pageSize));
    }
}