package com.no_mercy_no_doubt.tourism_booking.catalog.Hotel;

import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Hotel response (list view)")
public class HotelResponse {

    private Long id;
    private String name;
    private String description;
    private String address;
    private Long cityId;
    private String city;
    private String country;
    private String phone;
    private String email;
    private Long managerId;
    private Long ownerId;
    private String imageUrl;
    private Double latitude;
    private Double longitude;

    @Schema(description = "Room types (included in details only)")
    private List<RoomTypeResponse> roomTypes;
}
