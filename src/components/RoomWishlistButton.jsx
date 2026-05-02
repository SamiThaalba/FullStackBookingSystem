import { useTranslation } from "react-i18next";
import { useRoomWishlistToggle } from "../hooks/useRoomWishlistToggle";

export default function RoomWishlistButton({ room, hotel, enabled }) {
  const { t } = useTranslation();
  const { isInWishlist, toggleMutation } = useRoomWishlistToggle(room, hotel, enabled);

  if (!enabled) return null;

  return (
    <button
      type="button"
      className="btn btn-small btn-outline"
      onClick={() => toggleMutation.mutate({ add: !isInWishlist })}
    >
      {isInWishlist ? t("hotelCard.removeFromFav") : t("hotelCard.addToFav")}
    </button>
  );
}
