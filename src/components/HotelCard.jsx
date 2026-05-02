import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { compactAddress } from "../utils/format";
import { useHotelWishlistToggle } from "../hooks/useHotelWishlistToggle";

export default function HotelCard({ hotel }) {
  const { t } = useTranslation();
  const auth = useAuth();
  const canSave = auth.isAuthenticated && auth.isCustomer;
  const { isInWishlist, toggleMutation } = useHotelWishlistToggle(hotel, canSave);

  return (
    <article className="hotel-card">
      <div className="hotel-image" aria-hidden="true">
        {hotel.imageUrl ? (
          <img src={hotel.imageUrl} alt="" />
        ) : (
          <span>{hotel?.city?.slice(0, 2)?.toUpperCase() || "PI"}</span>
        )}
      </div>
      <div className="hotel-summary">
        <h3>{hotel.name}</h3>
        <p>{compactAddress(hotel) || t("hotelCard.premierLocation")}</p>
        {hotel.description && <p className="muted clamp">{hotel.description}</p>}
        <div className="amenity-row" aria-label={t("hotelCard.amenitiesAria")}>
          <span>{t("hotelCard.wifi")}</span>
          <span>{t("hotelCard.parking")}</span>
          <span>{t("hotelCard.restaurant")}</span>
        </div>
      </div>
      <div className="hotel-action">
        <div style={{ display: "grid", gap: 10 }}>
          <Link className="btn btn-teal" to={`/hotels/${hotel.id}`}>
            {t("hotelCard.viewDetails")}
          </Link>
          {canSave ? (
            <button
              type="button"
              className="btn btn-small btn-outline"
              onClick={() => toggleMutation.mutate({ add: !isInWishlist })}
            >
              {isInWishlist ? t("hotelCard.removeFromFav") : t("hotelCard.addToFav")}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
