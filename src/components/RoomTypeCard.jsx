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
    <article className="room-card room-card--hotel-detail">
      <div className="room-card__media" aria-hidden>
        {roomType.imageUrl ? (
          <img src={roomType.imageUrl} alt="" loading="lazy" />
        ) : (
          <span className="room-card__mediaFallback">Room</span>
        )}
      </div>
      <div className="room-card__content">
        <h3 className="room-card__title" title={roomType.name}>
          {roomType.name}
        </h3>

        <p className="room-card__desc">
          {roomType.description || "Room type"}
        </p>

        {(roomType.capacity || roomType.inventoryCount || (roomType.amenities || []).length) ? (
          <div className="amenity-row">
            <span>Sleeps {roomType.capacity}</span>
            <span>{roomType.inventoryCount} rooms</span>
            {(roomType.amenities || []).slice(0, 2).map((amenity) => (
              <span key={amenity}>{amenity}</span>
            ))}
            {(roomType.amenities || []).length > 2 ? (
              <span className="amenity-more">+{(roomType.amenities || []).length - 2}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <aside className="room-card__actions" aria-label={`${roomType.name} actions`}>
        <div className="room-card__actionsTop">
          {roomType.hotelId ? (
            <Link className="btn btn-small btn-outline room-card__alertBtn" to={`/hotels/${roomType.hotelId}`}>
              {t("hotels.viewHotel")}
            </Link>
          ) : (
            <span aria-hidden />
          )}
        </div>

        <div className="room-card__priceBlock">
          <div className="room-card__priceValue">{money(roomType.basePrice)}</div>
          <div className="room-card__priceMeta">{t("hotelDetail.perNight")}</div>
        </div>

        <button
          className="btn btn-teal room-action-btn room-action-btn--primary"
          disabled={removeMutation.isPending}
          onClick={() => removeMutation.mutate()}
          aria-label={t("hotelCard.removeFromFav")}
        >
          {removeMutation.isPending ? "Removing..." : t("hotelCard.removeFromFav")}
        </button>
      </aside>
    </article>
  );
}

