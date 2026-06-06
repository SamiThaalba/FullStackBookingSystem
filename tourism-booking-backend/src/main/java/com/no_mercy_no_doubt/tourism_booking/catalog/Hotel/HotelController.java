package com.no_mercy_no_doubt.tourism_booking.catalog.Hotel;

import com.no_mercy_no_doubt.tourism_booking.common.dto.PageResponse;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/hotels")
public class HotelController {

    private final HotelService service;

    public HotelController(HotelService hotelService) {
        this.service = hotelService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('hotel:create')")
    public ResponseEntity<HotelResponse> createHotel(@RequestBody @Valid HotelRequest value) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createHotel(value));
    }

    @GetMapping("/{id}")
    public ResponseEntity<HotelResponse> getHotel(@PathVariable long id) {
        return ResponseEntity.ok(service.getHotelById(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('hotel:update')")
    public ResponseEntity<HotelResponse> updateHotel(@PathVariable long id,
                                                     @Valid @RequestBody HotelRequest request) {
        return ResponseEntity.ok(service.updateHotel(id, request));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAuthority('hotel:update')")
    public ResponseEntity<HotelResponse> partialUpdateHotel(@PathVariable long id,
                                                            @Valid @RequestBody HotelPatchRequest request) {
        return ResponseEntity.ok(service.patchHotel(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('hotel:delete')")
    public ResponseEntity<Void> deleteHotel(@PathVariable long id) {
        service.deleteHotel(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/my")
    @PreAuthorize("hasAuthority('hotel:view')")
    public ResponseEntity<List<HotelResponse>> getMyHotels() {
        return ResponseEntity.ok(service.getMyHotels());
    }

    @GetMapping
    public ResponseEntity<PageResponse<HotelResponse>> getHotels(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) Integer guests,
            @RequestParam(required = false) Integer adults,
            @RequestParam(required = false) Integer children,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        int pageNum = (page != null && page >= 0) ? page : 0;
        int pageSize = (size != null && size > 0) ? size : 10;
        return ResponseEntity.ok(service.listHotelsWithFilters(
                city, country, name, guests, adults, children, from, to, pageNum, pageSize
        ));
    }
}