package com.no_mercy_no_doubt.tourism_booking.catalog.Hotel;

import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomType;
import com.no_mercy_no_doubt.tourism_booking.catalog.geography.City;
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

    /** Canonical location: one city implies its country via {@link City#getCountry()}. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "city_id")
    private City locatedCity;

    /** Decimal degrees WGS84; nullable for legacy rows until managers set coordinates. */
    private Double latitude;

    /** Decimal degrees WGS84 */
    private Double longitude;

    private String phone;

    private String email;

    @Column(name = "manager_id")
    private Long managerId;

    /** User who owns this hotel for access control (creator). SUPER_ADMIN uses {@code hotel:view_all} to bypass. */
    @Column(name = "owner_id")
    private Long ownerId;

    @OneToMany(mappedBy = "hotel", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RoomType> roomTypes = new ArrayList<>();

    public String getDisplayCity() {
        return locatedCity != null ? locatedCity.getName() : "";
    }

    public String getDisplayCountry() {
        if (locatedCity != null && locatedCity.getCountry() != null) {
            return locatedCity.getCountry().getName();
        }
        return "";
    }
}
