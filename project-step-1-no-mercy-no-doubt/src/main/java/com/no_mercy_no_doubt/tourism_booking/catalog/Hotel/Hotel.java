package com.no_mercy_no_doubt.tourism_booking.catalog.Hotel;

import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomType;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "hotels")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Hotel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String description;
    private String imageUrl;
    @Column(nullable = false)
    private String address;

    private String city;

    private String country;

    /** Decimal degrees WGS84; nullable for legacy rows until managers set coordinates. */
    private Double latitude;

    /** Decimal degrees WGS84 */
    private Double longitude;

    private String phone;

    private String email;

    @Column(name = "manager_id")
    private Long managerId;

    @OneToMany(mappedBy = "hotel", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RoomType> roomTypes = new ArrayList<>();
}