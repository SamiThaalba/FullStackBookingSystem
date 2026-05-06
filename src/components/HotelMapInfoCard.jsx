import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaBed, FaCoffee, FaDirections, FaHeart, FaRegHeart, FaRegStar, FaStar, FaStarHalfAlt, FaWifi } from "react-icons/fa";
import { useAuth } from "../auth/AuthContext";
import { useHotelWishlistToggle } from "../hooks/useHotelWishlistToggle";
import { money } from "../utils/format";

function clampRating(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.min(5, Math.max(0, x));
}

function StarRow({ rating }) {
  const r = clampRating(rating);
  if (r == null) return null;
  const full = Math.floor(r);
  const frac = r - full;
  const half = frac >= 0.25 && frac < 0.75;
  const extraFull = frac >= 0.75 ? 1 : 0;
  const nodes = [];
  for (let i = 0; i < 5; i += 1) {
    if (i < full) nodes.push(<FaStar key={i} className="hotel-map-info-card__star hotel-map-info-card__star--full" />);
    else if (i === full && half)
      nodes.push(<FaStarHalfAlt key={i} className="hotel-map-info-card__star hotel-map-info-card__star--full" />);
    else if (i === full && extraFull)
      nodes.push(<FaStar key={i} className="hotel-map-info-card__star hotel-map-info-card__star--full" />);
    else nodes.push(<FaRegStar key={i} className="hotel-map-info-card__star hotel-map-info-card__star--empty" />);
  }
  return (
    <div className="hotel-map-info-card__stars" aria-hidden>
      {nodes}
    </div>
  );
}

/**
 * Bottom sheet–style summary when a map pin is selected (discovery / home map).
 */
export default function HotelMapInfoCard({ hotel, onClose, detailBookingQuery = "" }) {
  const { t } = useTranslation();
  const auth = useAuth();
  const canSave = auth.isAuthenticated;
  const { isInWishlist, toggleMutation } = useHotelWishlistToggle(hotel, canSave);

  const lat = Number(hotel?.latitude);
  const lng = Number(hotel?.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const directionsHref = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`
    : null;

  const detailsPath =
    detailBookingQuery && detailBookingQuery.length > 0
      ? `/hotels/${hotel.id}?${detailBookingQuery}`
      : `/hotels/${hotel.id}`;

  const subtitle = [hotel.city, hotel.country].filter(Boolean).join(" · ");
  const priceVal = hotel?.startingFrom ?? hotel?.minPrice ?? hotel?.fromPrice;
  const showPrice = Number.isFinite(Number(priceVal)) && Number(priceVal) > 0;
  const ratingVal = hotel?.averageRating ?? hotel?.rating;
  const reviewCount = hotel?.reviewCount;
  const hasNumericRating = clampRating(ratingVal) != null;
  const hasReviews = reviewCount != null && Number(reviewCount) > 0;
  const showRating = hasNumericRating || hasReviews;

  return (
    <div
      className="hotel-map-info-card"
      role="dialog"
      aria-labelledby={`hotel-map-info-title-${hotel.id}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" className="hotel-map-info-card__close" onClick={onClose} aria-label={t("hotels.mapInfoClose")}>
        ×
      </button>

      <div className="hotel-map-info-card__hero">
        {hotel.imageUrl ? (
          <img src={hotel.imageUrl} alt="" className="hotel-map-info-card__hero-img" />
        ) : (
          <div className="hotel-map-info-card__hero-placeholder" aria-hidden>
            {(hotel?.name || "?").slice(0, 1)}
          </div>
        )}
        {showPrice ? (
          <div className="hotel-map-info-card__price-pill">{money(Number(priceVal))}</div>
        ) : null}
      </div>

      <div className="hotel-map-info-card__body">
        <div className="hotel-map-info-card__headline">
          <div className="hotel-map-info-card__titles">
            <h2 id={`hotel-map-info-title-${hotel.id}`} className="hotel-map-info-card__name" dir="auto">
              {hotel.name}
            </h2>
            {subtitle ? (
              <p className="hotel-map-info-card__subtitle" dir="auto">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="hotel-map-info-card__icon-actions">
            {directionsHref ? (
              <a
                className="hotel-map-info-card__icon-btn"
                href={directionsHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("hotels.mapInfoDirections")}
              >
                <FaDirections size={18} />
              </a>
            ) : null}
            {canSave ? (
              <button
                type="button"
                className="hotel-map-info-card__icon-btn"
                onClick={() => toggleMutation.mutate({ add: !isInWishlist })}
                aria-label={isInWishlist ? t("hotelCard.removeFromFav") : t("hotelCard.addToFav")}
                aria-pressed={isInWishlist}
              >
                {isInWishlist ? <FaHeart size={18} /> : <FaRegHeart size={18} />}
              </button>
            ) : null}
          </div>
        </div>

        {showRating ? (
          <div className="hotel-map-info-card__rating-row">
            {hasNumericRating ? <span className="hotel-map-info-card__rating-num">{Number(ratingVal).toFixed(1)}</span> : null}
            {hasNumericRating ? <StarRow rating={ratingVal} /> : null}
            {hasReviews ? <span className="hotel-map-info-card__reviews">({Number(reviewCount)})</span> : null}
          </div>
        ) : null}

        <p className="hotel-map-info-card__category">{t("hotels.mapInfoCategory")}</p>

        <ul className="hotel-map-info-card__amenities">
          <li>
            <FaWifi className="hotel-map-info-card__amenity-ic" aria-hidden />
            {t("hotels.mapInfoWifi")}
          </li>
          <li>
            <FaCoffee className="hotel-map-info-card__amenity-ic" aria-hidden />
            {t("hotels.mapInfoBreakfast")}
          </li>
        </ul>

        <Link className="btn btn-teal hotel-map-info-card__cta" to={detailsPath}>
          {t("hotels.mapInfoGoToHotel")}
          <FaBed size={18} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
