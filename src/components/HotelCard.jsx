import { Link } from "react-router-dom";
import { compactAddress } from "../utils/format";

export default function HotelCard({ hotel }) {
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
        <p>{compactAddress(hotel) || "Premier city location"}</p>
        {hotel.description && <p className="muted clamp">{hotel.description}</p>}
        <div className="amenity-row" aria-label="Featured amenities">
          <span>WiFi</span>
          <span>Parking</span>
          <span>Restaurant</span>
        </div>
      </div>
      <div className="hotel-action">
        <Link className="btn btn-teal" to={`/hotels/${hotel.id}`}>
          View details
        </Link>
      </div>
    </article>
  );
}
