import { useTranslation } from "react-i18next";
import { useRoomWishlistToggle } from "../hooks/useRoomWishlistToggle";

export default function RoomWishlistButton({ room, hotel, enabled }) {
  const { t } = useTranslation();
  const { isInWishlist, toggleMutation } = useRoomWishlistToggle(room, hotel, enabled);

  if (!enabled) return null;

  return (
    <button
      type="button"
      className="btn btn-small btn-outline room-action-btn room-action-btn--icon"
      onClick={() => toggleMutation.mutate({ add: !isInWishlist })}
      aria-label={isInWishlist ? t("hotelCard.removeFromFav") : t("hotelCard.addToFav")}
      title={isInWishlist ? t("hotelCard.removeFromFav") : t("hotelCard.addToFav")}
    >
      <span aria-hidden>{isInWishlist ? "♥" : "♡"}</span>
    </button>
  );
}
