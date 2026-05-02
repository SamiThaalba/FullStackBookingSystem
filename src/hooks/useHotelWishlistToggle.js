import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { bookingApi } from "../api/bookingApi";

export function isHotelInWishlistItems(wishlist, hotelId) {
  if (hotelId == null || Number.isNaN(Number(hotelId))) return false;
  const id = Number(hotelId);
  return (wishlist || []).some(
    (i) => String(i.itemType) === "HOTEL" && Number(i.targetId) === id,
  );
}

/**
 * Optimistic add/remove hotel on wishlist (no loading label).
 * @param {object|null|undefined} hotel - must include id, name; city/imageUrl optional
 * @param {boolean} enabled - fetch wishlist only when true
 */
export function useHotelWishlistToggle(hotel, enabled) {
  const queryClient = useQueryClient();
  const hotelId = hotel?.id;

  const { data: wishlist } = useQuery({
    queryKey: ["wishlist"],
    queryFn: bookingApi.wishlist,
    enabled: Boolean(enabled && hotelId != null),
  });
  const isInWishlist = useMemo(
    () => isHotelInWishlistItems(wishlist, hotelId),
    [wishlist, hotelId],
  );

  const toggleMutation = useMutation({
    mutationFn: ({ add }) =>
      add
        ? bookingApi.addToWishlist({ itemType: "HOTEL", targetId: hotelId })
        : bookingApi.removeFromWishlist({ itemType: "HOTEL", targetId: hotelId }),
    onMutate: async ({ add }) => {
      await queryClient.cancelQueries({ queryKey: ["wishlist"] });
      const previous = queryClient.getQueryData(["wishlist"]);
      const list = Array.isArray(previous) ? previous : [];

      if (add) {
        queryClient.setQueryData(["wishlist"], [
          ...list,
          {
            id: -Date.now(),
            itemType: "HOTEL",
            targetId: hotelId,
            targetName: hotel?.name ?? "",
            imageUrl: hotel?.imageUrl ?? null,
            subtitle: hotel?.city ?? null,
            note: null,
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        queryClient.setQueryData(
          ["wishlist"],
          list.filter(
            (i) => !(String(i.itemType) === "HOTEL" && Number(i.targetId) === Number(hotelId)),
          ),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["wishlist"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

  return { isInWishlist, toggleMutation };
}
