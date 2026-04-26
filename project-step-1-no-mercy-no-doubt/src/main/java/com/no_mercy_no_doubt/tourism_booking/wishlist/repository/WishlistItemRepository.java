package com.no_mercy_no_doubt.tourism_booking.wishlist.repository;

import com.no_mercy_no_doubt.tourism_booking.wishlist.entity.WishlistItem;
import com.no_mercy_no_doubt.tourism_booking.wishlist.enums.WishlistItemType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WishlistItemRepository extends JpaRepository<WishlistItem, Long> {

    List<WishlistItem> findByUserIdOrderByCreatedAtDesc(Long userId);

    boolean existsByUserIdAndItemTypeAndTargetId(Long userId, WishlistItemType itemType, Long targetId);

    Optional<WishlistItem> findByUserIdAndItemTypeAndTargetId(Long userId, WishlistItemType itemType, Long targetId);

    void deleteByUserIdAndItemTypeAndTargetId(Long userId, WishlistItemType itemType, Long targetId);
}