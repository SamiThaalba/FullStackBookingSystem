import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { useAuth } from "../auth/AuthContext";
import { compactAddress } from "../utils/format";
import { useHotelWishlistToggle } from "../hooks/useHotelWishlistToggle";

/** Matches list API payloads: amenities as string[] or legacy comma-separated string. */
function amenitiesFromHotel(hotel) {
  const raw = hotel?.amenities;
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

const MAX_HOTEL_CARD_AMENITIES = 3;

export default function HotelCard({ hotel }) {
  const { t } = useTranslation();
  const auth = useAuth();
  const canSave = auth.isAuthenticated;
  const { isInWishlist, toggleMutation } = useHotelWishlistToggle(hotel, canSave);

  const amenities = amenitiesFromHotel(hotel);

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
        {amenities.length > 0 ? (
          <div className="amenity-row" aria-label={t("hotelCard.amenitiesAria")}>
            {amenities.slice(0, MAX_HOTEL_CARD_AMENITIES).map((label, idx) => (
              <span key={`${idx}-${label}`}>{label}</span>
            ))}
            {amenities.length > MAX_HOTEL_CARD_AMENITIES ? (
              <span className="amenity-more">+{amenities.length - MAX_HOTEL_CARD_AMENITIES}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="hotel-action">
        <div style={{ display: "grid", gap: 10 }}>
          <Link className="btn btn-teal" to={`/hotels/${hotel.id}`}>
            {t("hotelCard.viewDetails")}
          </Link>
          {canSave ? (
            <button
              type="button"
              className="btn btn-small btn-outline fav-btn"
              onClick={() => toggleMutation.mutate({ add: !isInWishlist })}
              aria-label={isInWishlist ? t("hotelCard.removeFromFav") : t("hotelCard.addToFav")}
              aria-pressed={isInWishlist}
            >
              {isInWishlist ? <FaHeart size={16} /> : <FaRegHeart size={16} />}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
