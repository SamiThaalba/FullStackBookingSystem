package com.no_mercy_no_doubt.tourism_booking.wishlist.dto;

import com.no_mercy_no_doubt.tourism_booking.wishlist.enums.WishlistItemType;

import java.time.LocalDateTime;

public record WishlistResponse(
        Long id,
        WishlistItemType itemType,
        Long targetId,
        String targetName,
        String imageUrl,
        String subtitle,
        String note,
        LocalDateTime createdAt
) {
}