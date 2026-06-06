package com.no_mercy_no_doubt.tourism_booking.wishlist.dto;

import com.no_mercy_no_doubt.tourism_booking.wishlist.enums.WishlistItemType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateWishlistRequest(
        @NotNull WishlistItemType itemType,
        @NotNull Long targetId,
        @Size(max = 500) String note
) {
}