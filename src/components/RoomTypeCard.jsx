import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { bookingApi } from "../api/bookingApi";
import { money } from "../utils/format";
import { useTranslation } from "react-i18next";

export default function RoomTypeCard({ roomType, onRemove }) {
  const queryClient = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: () => bookingApi.removeFromWishlist({ itemType: "ROOM_TYPE", targetId: roomType.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      onRemove?.();
    },
  });
  const { t } = useTranslation();

  return (
    <article className="room-card" style={{ alignItems: "center" }}>
      <div className="room-card__media" aria-hidden>
        {roomType.imageUrl ? (
          <img src={roomType.imageUrl} alt="" loading="lazy" />
        ) : (
          <span className="room-card__mediaFallback">Room</span>
        )}
      </div>
      <div>
        <h3>{roomType.name}</h3>
        <p className="muted">{roomType.description || "Room type"}</p>
        <div className="amenity-row">
          <span>Sleeps {roomType.capacity}</span>
          <span>{roomType.inventoryCount} rooms</span>
          {(roomType.amenities || []).slice(0, 3).map((amenity) => (
            <span key={amenity}>{amenity}</span>
          ))}
        </div>
      </div>
      <div className="room-price">
        <strong>{money(roomType.basePrice)} {t("hotelDetail.perNight")}</strong>
        {roomType.hotelId ? (
          <Link className="btn btn-small btn-outline" to={`/hotels/${roomType.hotelId}`}>
            {t("hotels.viewHotel")}
          </Link>
        ) : null}
        <button className="btn btn-small btn-outline" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate()}>
          {removeMutation.isPending ? "Removing..." : t("hotelCard.removeFromFav")}
        </button>
      </div>
    </article>
  );
}

