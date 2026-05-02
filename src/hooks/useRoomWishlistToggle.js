import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { bookingApi } from "../api/bookingApi";

export function isRoomTypeInWishlistItems(wishlist, roomTypeId) {
  if (roomTypeId == null || Number.isNaN(Number(roomTypeId))) return false;
  const id = Number(roomTypeId);
  return (wishlist || []).some(
    (i) => String(i.itemType) === "ROOM_TYPE" && Number(i.targetId) === id,
  );
}

/**
 * Optimistic add/remove room type on wishlist (no loading / disabled state).
 * @param {object|null|undefined} room - must include id, name
 * @param {object|null|undefined} hotel - optional; imageUrl / name for optimistic list row
 * @param {boolean} enabled
 */
export function useRoomWishlistToggle(room, hotel, enabled) {
  const queryClient = useQueryClient();
  const roomId = room?.id;

  const { data: wishlist } = useQuery({
    queryKey: ["wishlist"],
    queryFn: bookingApi.wishlist,
    enabled: Boolean(enabled && roomId != null),
  });
  const isInWishlist = useMemo(
    () => isRoomTypeInWishlistItems(wishlist, roomId),
    [wishlist, roomId],
  );

  const toggleMutation = useMutation({
    mutationFn: ({ add }) =>
      add
        ? bookingApi.addToWishlist({ itemType: "ROOM_TYPE", targetId: roomId })
        : bookingApi.removeFromWishlist({ itemType: "ROOM_TYPE", targetId: roomId }),
    onMutate: async ({ add }) => {
      await queryClient.cancelQueries({ queryKey: ["wishlist"] });
      const previous = queryClient.getQueryData(["wishlist"]);
      const list = Array.isArray(previous) ? previous : [];

      if (add) {
        queryClient.setQueryData(["wishlist"], [
          ...list,
          {
            id: -Date.now(),
            itemType: "ROOM_TYPE",
            targetId: roomId,
            targetName: room?.name ?? "",
            imageUrl: hotel?.imageUrl ?? null,
            subtitle: hotel?.name ?? null,
            note: null,
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        queryClient.setQueryData(
          ["wishlist"],
          list.filter(
            (i) =>
              !(
                String(i.itemType) === "ROOM_TYPE" &&
                Number(i.targetId) === Number(roomId)
              ),
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
