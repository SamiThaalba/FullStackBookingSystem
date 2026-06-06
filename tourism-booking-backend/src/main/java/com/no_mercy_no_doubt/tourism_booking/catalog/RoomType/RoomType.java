package com.no_mercy_no_doubt.tourism_booking.catalog.RoomType;

import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.Hotel;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "room_types")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String description;

    /**
     * Optional public URL for a room-type cover image (e.g. Supabase public object URL).
     * Stored as a plain string so the frontend can render it directly.
     */
    @Column(name = "image_url")
    private String imageUrl;

    @Column(nullable = false)
    private int capacity;

    @Column(name = "inventory_count", nullable = false)
    @Builder.Default
    private int inventoryCount = 1;

    @Column(name = "base_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal basePrice;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "room_type_amenities", joinColumns = @JoinColumn(name = "room_type_id"))
    @Column(name = "amenity")
    @Builder.Default
    private List<String> amenities = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;
}
