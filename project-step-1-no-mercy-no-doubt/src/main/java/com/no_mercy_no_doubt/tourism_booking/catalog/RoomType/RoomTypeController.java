package com.no_mercy_no_doubt.tourism_booking.catalog.RoomType;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/room-type")
@PreAuthorize("isAuthenticated()")
public class RoomTypeController {

    private final RoomTypeService service;

    public RoomTypeController(RoomTypeService service) {
        this.service = service;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('room:create')")
    public ResponseEntity<RoomTypeResponse> post(@RequestBody @Valid RoomTypeRequest value) {
        RoomTypeResponse created = service.createRoomType(value);
        URI location = URI.create("/api/room-type/" + created.getId());
        return ResponseEntity.created(location).body(created);
    }

    @GetMapping("/hotel/{hotelId}")
    @PreAuthorize("hasAuthority('room:view')")
    public ResponseEntity<List<RoomTypeResponse>> getRoomTypesByHotel(@PathVariable long hotelId) {
        return ResponseEntity.ok(service.getRoomTypesByHotel(hotelId));
    }

    @GetMapping("/{roomTypeId}")
    @PreAuthorize("hasAuthority('room:view')")
    public ResponseEntity<RoomTypeResponse> getRoomTypeById(@PathVariable long roomTypeId) {
        return ResponseEntity.ok(service.getRoomTypeById(roomTypeId));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('room:update')")
    public ResponseEntity<RoomTypeResponse> put(@PathVariable long id, @RequestBody @Valid RoomTypeRequest value) {
        return ResponseEntity.ok(service.updateRoomType(id, value));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('room:delete')")
    public ResponseEntity<Void> deleteRoomType(@PathVariable long id) {
        service.deleteRoomType(id);
        return ResponseEntity.noContent().build();
    }
}