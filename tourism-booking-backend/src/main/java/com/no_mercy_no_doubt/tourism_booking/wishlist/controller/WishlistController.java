package com.no_mercy_no_doubt.tourism_booking.wishlist.controller;

import com.no_mercy_no_doubt.tourism_booking.wishlist.dto.CreateWishlistRequest;
import com.no_mercy_no_doubt.tourism_booking.wishlist.dto.WishlistResponse;
import com.no_mercy_no_doubt.tourism_booking.wishlist.enums.WishlistItemType;
import com.no_mercy_no_doubt.tourism_booking.wishlist.service.WishlistService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/wishlist")
@RequiredArgsConstructor
@Tag(name = "Wishlist", description = "Saved hotels and room types for the authenticated user")
public class WishlistController {

    private final WishlistService wishlistService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Add a hotel or room type to the wishlist")
    public WishlistResponse add(@Valid @RequestBody CreateWishlistRequest request) {
        return wishlistService.add(request);
    }

    @GetMapping
    @Operation(summary = "List current user's wishlist")
    public List<WishlistResponse> myWishlist() {
        return wishlistService.myWishlist();
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove an item from the wishlist")
    public void remove(
            @RequestParam WishlistItemType itemType,
            @RequestParam Long targetId
    ) {
        wishlistService.remove(itemType, targetId);
    }
}