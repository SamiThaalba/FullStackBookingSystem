import { Link } from "react-router-dom";

/** Pin hitbox / map anchor slot — keep in sync with `.hotel-map-label__pin` in CSS */
export const HOTEL_MAP_PIN_WIDTH = 40;
export const HOTEL_MAP_PIN_HEIGHT = 40;

/** Map lat/lng aligns to the visual tip of the pin (near bottom of slot) */
const PIN_TIP_Y_FRAC = 38 / 40;

export function HotelMapLabel({ hotel }) {
  const title = hotel.city ? `${hotel.name} — ${hotel.city}` : hotel.name;

  return (
    <Link
      to={`/hotels/${hotel.id}`}
      className="hotel-map-label"
      dir="ltr"
      title={title}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="hotel-map-label__pin" aria-hidden>
        <span className="hotel-map-label__pin-body" />
      </span>
      <span className="hotel-map-label__name" dir="auto">
        {hotel.name}
      </span>
    </Link>
  );
}

export function hotelMapLabelPixelOffset(width, height) {
  void width;
  const pinH = HOTEL_MAP_PIN_HEIGHT;
  const pinTop = Math.max(0, (height - pinH) / 2);
  const pinTipY = pinH * PIN_TIP_Y_FRAC;
  const pinBottom = pinTop + pinTipY;
  return { x: -HOTEL_MAP_PIN_WIDTH / 2, y: -pinBottom };
}
